// Telebirr Fabric Payment Gateway client.
//
// SCOPE: this module only ever moves money with the driver's explicit authorisation.
// Passenger fares go through the regular merchant order flow (createOrder); the
// per-trip 5 birr operator fee goes through the mandate flow (createMandateOrder),
// which requires the driver to have approved a direct-debit mandate in the Telebirr
// app. There is deliberately no code path here that debits a wallet without a
// mandate the driver set up themselves.
//
// Credential handling: everything comes from the environment. If credentials are
// missing, isConfigured() returns false and callers must not record a settlement as
// paid. See assertConfigured() usage in server.js.

const crypto = require('crypto');

const TEST_GATEWAY = 'https://developerportal.ethiotelebirr.et:38443/apiaccess/payment/gateway';
const PROD_GATEWAY = 'https://superapp.ethiomobilemoney.et:38443/apiaccess/payment/gateway';

const REQUIRED_VARS = [
  'TELEBIRR_FABRIC_APP_ID',
  'TELEBIRR_APP_SECRET',
  'TELEBIRR_MERCHANT_APP_ID',
  'TELEBIRR_MERCHANT_CODE',
  'TELEBIRR_PRIVATE_KEY',
  'TELEBIRR_PUBLIC_KEY',
];

function loadConfig() {
  const environment = (process.env.TELEBIRR_ENVIRONMENT || 'test').toLowerCase();
  return {
    environment,
    isProduction: environment === 'production',
    baseUrl: process.env.TELEBIRR_BASE_URL || (environment === 'production' ? PROD_GATEWAY : TEST_GATEWAY),
    fabricAppId: process.env.TELEBIRR_FABRIC_APP_ID,
    appSecret: process.env.TELEBIRR_APP_SECRET,
    merchantAppId: process.env.TELEBIRR_MERCHANT_APP_ID,
    merchantCode: process.env.TELEBIRR_MERCHANT_CODE,
    privateKey: process.env.TELEBIRR_PRIVATE_KEY,
    publicKey: process.env.TELEBIRR_PUBLIC_KEY,
    // Contract that has the mandate / direct-debit product enabled. A plain
    // BuyGoods contract will reject mandate orders with 60200098.
    contractNo: process.env.TELEBIRR_MANDATE_CONTRACT_NO,
    timeout: Number(process.env.TELEBIRR_TIMEOUT_SECONDS || 30),
  };
}

function missingVars() {
  return REQUIRED_VARS.filter((name) => !process.env[name]);
}

function isConfigured() {
  return missingVars().length === 0;
}

class TelebirrError extends Error {
  constructor(message, { code, httpStatus, raw } = {}) {
    super(message);
    this.name = 'TelebirrError';
    this.code = code;
    this.httpStatus = httpStatus;
    this.raw = raw;
  }
}

// Ethio Telecom issues keys as bare base64 DER on a single line, with no
// -----BEGIN----- armour. Node needs PEM, so wrap it and try both PKCS#8 and
// PKCS#1 headers -- which one is correct depends on how the key was issued.
function toPem(key, kind) {
  const value = String(key).trim();
  if (value.includes('-----BEGIN')) return value.replace(/\\n/g, '\n');

  const body = value.replace(/\s+/g, '');
  const label = kind === 'public' ? 'PUBLIC KEY' : 'PRIVATE KEY';
  const wrapped = body.replace(/(.{64})/g, '$1\n').trim();
  return `-----BEGIN ${label}-----\n${wrapped}\n-----END ${label}-----`;
}

function loadPrivateKey(raw) {
  const headers = ['PRIVATE KEY', 'RSA PRIVATE KEY'];
  let lastError;
  for (const label of headers) {
    const pem = raw.includes('-----BEGIN')
      ? raw.replace(/\\n/g, '\n')
      : `-----BEGIN ${label}-----\n${String(raw).trim().replace(/(.{64})/g, '$1\n').trim()}\n-----END ${label}-----`;
    try {
      return crypto.createPrivateKey(pem);
    } catch (err) {
      lastError = err;
    }
  }
  throw new TelebirrError(`TELEBIRR_PRIVATE_KEY could not be parsed: ${lastError.message}`);
}

function loadPublicKey(raw) {
  const headers = ['PUBLIC KEY', 'RSA PUBLIC KEY'];
  let lastError;
  for (const label of headers) {
    const pem = raw.includes('-----BEGIN')
      ? raw.replace(/\\n/g, '\n')
      : `-----BEGIN ${label}-----\n${String(raw).trim().replace(/(.{64})/g, '$1\n').trim()}\n-----END ${label}-----`;
    try {
      return crypto.createPublicKey(pem);
    } catch (err) {
      lastError = err;
    }
  }
  throw new TelebirrError(`TELEBIRR_PUBLIC_KEY could not be parsed: ${lastError.message}`);
}

// Fabric signs over the alphabetically sorted query string, then the raw body.
function buildSignSource(params, body) {
  const query = Object.keys(params)
    .filter((key) => params[key] !== undefined && params[key] !== null && params[key] !== '')
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');
  return query + (body || '');
}

function sign(source, rawPrivateKey) {
  return crypto.sign('sha256', Buffer.from(source, 'utf8'), {
    key: loadPrivateKey(rawPrivateKey),
    padding: crypto.constants.RSA_PKCS1_PADDING,
  }).toString('base64');
}

// Telebirr signs its responses with RSA-PSS. Never trust a response body we
// cannot verify -- that is the whole basis for marking a settlement as paid.
function verifyResponse(responseBody, signature, rawPublicKey) {
  try {
    return crypto.verify(
      'sha256',
      Buffer.from(responseBody, 'utf8'),
      {
        key: loadPublicKey(rawPublicKey),
        padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
        saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
      },
      Buffer.from(signature, 'base64'),
    );
  } catch (err) {
    throw new TelebirrError(`Signature verification failed: ${err.message}`);
  }
}

function timestamp() {
  // Fabric rejects requests more than a minute out of step with server time.
  return String(Math.floor(Date.now() / 1000));
}

function nonce() {
  return crypto.randomBytes(16).toString('hex');
}

let tokenCache = { token: null, expiresAt: 0 };

async function getFabricToken(config) {
  if (tokenCache.token && Date.now() < tokenCache.expiresAt - 30000) {
    return tokenCache.token;
  }

  const body = JSON.stringify({ appId: config.fabricAppId, timestamp: timestamp() });
  const params = { appId: config.fabricAppId, timestamp: timestamp() };
  const signature = sign(buildSignSource(params, ''), config.privateKey);

  const payload = JSON.stringify({
    appId: config.fabricAppId,
    timestamp: params.timestamp,
    sign: signature,
  });

  // Fabric expects the token exchange payload encrypted with Telebirr's public key.
  const encrypted = crypto
    .publicEncrypt(
      { key: loadPublicKey(config.publicKey), padding: crypto.constants.RSA_PKCS1_PADDING },
      Buffer.from(payload, 'utf8'),
    )
    .toString('base64');

  const response = await postJson(config, '/api/v1/auth/token', { encrypted }, false);
  const token = response.token || (response.biz_content && response.biz_content.token);

  if (!token) {
    throw new TelebirrError('Fabric token response contained no token', { raw: response });
  }

  // Fabric tokens are valid for ~24h; refresh early rather than tracking the
  // exact expiry, which the gateway does not always return.
  tokenCache = { token, expiresAt: Date.now() + 3600000 };
  return token;
}

async function postJson(config, path, bodyObject, signRequest = true) {
  const token = await getFabricToken(config);
  const body = JSON.stringify(bodyObject);
  const params = { appId: config.merchantAppId, timestamp: timestamp(), nonce: nonce() };

  if (signRequest) {
    params.sign_type = 'SHA256WithRSA';
    params.sign = sign(buildSignSource(params, body), config.privateKey);
  }

  const url = new URL(path, config.baseUrl);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  url.searchParams.set('token', token);

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal: AbortSignal.timeout(config.timeout * 1000),
    });
  } catch (err) {
    throw new TelebirrError(`Network failure calling ${path}: ${err.message}`);
  }

  const text = await response.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new TelebirrError(`Non-JSON response from ${path} (HTTP ${response.status})`, {
      httpStatus: response.status,
      raw: text,
    });
  }

  if (parsed.sign) {
    const valid = verifyResponse(text, parsed.sign, config.publicKey);
    if (!valid) {
      throw new TelebirrError(`Response signature from ${path} did not verify`, {
        httpStatus: response.status,
        raw: parsed,
      });
    }
  } else if (signRequest) {
    throw new TelebirrError(`Unsigned response from ${path} rejected`, {
      httpStatus: response.status,
      raw: parsed,
    });
  }

  if (parsed.code && parsed.code !== '0' && parsed.code !== 0) {
    throw new TelebirrError(`${parsed.msg || 'Telebirr rejected the request'} (${path})`, {
      code: parsed.code,
      httpStatus: response.status,
      raw: parsed,
    });
  }

  return parsed;
}

// Standard merchant order. Used for the passenger's fare.
async function createOrder(config, { merchantOrderId, amount, title, notifyUrl, redirectUrl }) {
  const response = await postJson(config, '/api/v1/orders/create', {
    appid: config.merchantAppId,
    title,
    merch_code: config.merchantCode,
    notify_url: notifyUrl,
    payee_type: '5000',
    trade_type: 'Cross-App',
    redirect_url: redirectUrl,
    total_amount: Number(amount).toFixed(2),
    business_type: 'BuyGoods',
    merch_order_id: merchantOrderId,
    trans_currency: 'ETB',
    timeout_express: process.env.TELEBIRR_ORDER_TIMEOUT || '120m',
    payee_identifier: config.merchantCode,
    payee_identifier_type: '04',
  });

  const biz = response.biz_content || response.result || {};
  return {
    prepayId: biz.prepay_id,
    receiveCode: biz.receiveCode,
    merchantOrderId: biz.merch_order_id || merchantOrderId,
  };
}

// Mandate order. This is the 5 birr operator fee. It only succeeds if the driver
// has approved a direct-debit mandate for contractNo in the Telebirr app; if they
// have not, the gateway returns an error and we must NOT mark the fee as paid.
async function createMandateOrder(config, { merchantOrderId, amount, title, notifyUrl, driverPhone }) {
  if (!config.contractNo) {
    throw new TelebirrError(
      'TELEBIRR_MANDATE_CONTRACT_NO is not set. Mandate orders need a contract with the direct-debit product enabled; a plain BuyGoods contract cannot debit a driver wallet.',
    );
  }

  const response = await postJson(config, '/api/v1/orders/mandate', {
    appid: config.merchantAppId,
    title,
    merch_code: config.merchantCode,
    notify_url: notifyUrl,
    payee_type: '5000',
    trade_type: 'Cross-App',
    total_amount: Number(amount).toFixed(2),
    business_type: 'BuyGoods',
    merch_order_id: merchantOrderId,
    trans_currency: 'ETB',
    timeout_express: process.env.TELEBIRR_ORDER_TIMEOUT || '120m',
    payee_identifier: config.merchantCode,
    payee_identifier_type: '04',
    contract_no: config.contractNo,
    // Telebirr uses this to tell which mandate to debit.
    payer_phone: driverPhone,
  });

  const biz = response.biz_content || response.result || {};
  return {
    prepayId: biz.prepay_id,
    receiveCode: biz.receiveCode,
    merchantOrderId: biz.merch_order_id || merchantOrderId,
  };
}

async function queryOrder(config, { merchantOrderId }) {
  const response = await postJson(config, '/api/v1/orders/query', {
    appid: config.merchantAppId,
    merch_order_id: merchantOrderId,
    trans_currency: 'ETB',
  });

  const biz = response.biz_content || response.result || {};
  return {
    orderId: biz.order_id || biz.payment_order_id,
    tradeStatus: biz.trade_status || biz.trade_status_desc,
    amount: biz.total_amount,
    paidAt: biz.trans_end_time,
    payerPhone: biz.payer_phone,
  };
}

// Server-to-server callback verification. Telebirr POSTs the full transaction to
// notify_url; we confirm the signature over the raw body before touching the ledger.
function verifyNotify(rawBody, signature, rawPublicKey) {
  return verifyResponse(rawBody, signature, rawPublicKey);
}

module.exports = {
  TelebirrError,
  loadConfig,
  isConfigured,
  missingVars,
  createOrder,
  createMandateOrder,
  queryOrder,
  verifyNotify,
  buildSignSource,
};
