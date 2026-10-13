const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const { Pool } = require('pg');
const telebirr = require('./telebirr');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

app.use(cors());
// Telebirr signs the exact bytes of its callback body, so keep a raw copy.
// Signing a re-serialised object would produce a different signature.
app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf && buf.length ? buf.toString('utf8') : undefined;
    },
  })
);
app.use(express.static(path.join(__dirname, 'public')));

// Database Connection
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ DATABASE_URL is not set. Refusing to start without an explicit database URL.');
  console.error('   See server/.env.example. Never hardcode credentials here.');
  process.exit(1);
}

const isInternalRailway = connectionString.includes('railway.internal') || connectionString.includes('localhost');

const pool = new Pool({
  connectionString,
  ssl: isInternalRailway ? false : { rejectUnauthorized: false },
  connectionTimeoutMillis: 5000,
});

let dbConnected = false;

// schema.sql is the single source of truth for the schema. It used to be
// duplicated inline here, which meant the two could drift apart silently.
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

async function initDb() {
  try {
    const client = await pool.connect();
    console.log('✅ Connected successfully to PostgreSQL database on Railway!');
    dbConnected = true;

    const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
    await client.query(schema);
    console.log('✅ PostgreSQL schema applied (schema.sql).');
    client.release();
  } catch (err) {
    console.warn('⚠️ Notice: Could not connect to PostgreSQL directly from this host:');
    console.warn(`   ${err.message}`);
    console.warn('   (Note: If running outside Railway, ensure you use the Public Railway TCP proxy URL or deploy this server to Railway).');
    console.warn('   The server will run in hybrid/in-memory fallback mode for local testing until DB connects.');
  }
}


initDb();

// In-memory fallback if DB is temporarily unreachable from local network
const inMemorySeats = new Map();
const inMemoryPayments = [];
const inMemorySettlements = new Map();
const inMemoryAccess = new Map();

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const DEFAULT_FEE_PER_TRIP = Number(process.env.FEE_PER_TRIP || 5);
const SETTLEMENT_PAYEE_PHONE = process.env.SETTLEMENT_PAYEE_PHONE || '0942927999';
const QR_TOKEN_TTL_SECONDS = Number(process.env.QR_TOKEN_TTL_SECONDS || 900);

// One-time activation fee that unlocks the driver app. Charged through the same
// Telebirr mandate flow as the per-trip fee, so the driver sees one consistent
// "approve this debit in your Telebirr app" moment and there is only one
// money-moving code path in this service.
const ACCESS_FEE_AMOUNT = Number(process.env.ACCESS_FEE_AMOUNT || 5);

// Prefix on driver-access Telebirr order ids. The notify callback routes on this
// so a single callback endpoint can serve both settlements and access requests.
const ACCESS_ORDER_PREFIX = 'ACCESS';

if (!process.env.QR_TOKEN_SECRET) {
  console.warn('⚠️  QR_TOKEN_SECRET is not set. Seat payments cannot be authenticated.');
  console.warn('   Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
}

// Absolute base URL used to build passenger QR links and Telebirr notify_url.
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || '').replace(/\/+$/, '');

// ---------------------------------------------------------------------------
// QR token signing
//
// The seat-payment endpoint used to accept an unauthenticated POST, so anyone
// could mark a seat paid. A seat QR now carries a short-lived HMAC over the exact
// trip/seat/amount it was issued for, and /api/pay rejects anything that does not
// match. Only the server can mint these, so the client must fetch a QR link
// instead of building one itself.
// ---------------------------------------------------------------------------

// A payment can cover one seat (the common case) or several seats when one
// passenger pays for a group. The seat set is always sorted and de-duplicated so
// the same seats produce the same canonical string regardless of tap order.
function normalizeSeatNumbers(input) {
  const raw = Array.isArray(input) ? input : String(input ?? '').split(',');
  const nums = raw
    .map((value) => Number(String(value).trim()))
    .filter((n) => Number.isInteger(n) && n > 0);
  return Array.from(new Set(nums)).sort((a, b) => a - b);
}

function canonicalQrPayload({ tripId, seatNumbers, amount, expiresAt }) {
  return [tripId, seatNumbers.join(','), Number(amount).toFixed(2), expiresAt].join('|');
}

function signQrPayload(payload) {
  const secret = process.env.QR_TOKEN_SECRET || '';
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

function issueQrToken({ tripId, seatNumbers, amount }) {
  if (!process.env.QR_TOKEN_SECRET) {
    throw new Error('QR_TOKEN_SECRET is not configured');
  }
  const expiresAt = Math.floor(Date.now() / 1000) + QR_TOKEN_TTL_SECONDS;
  const payload = canonicalQrPayload({ tripId, seatNumbers, amount, expiresAt });
  return { payload, signature: signQrPayload(payload), expiresAt };
}

function verifyQrToken({ tripId, seatNumbers, amount, expiresAt, signature }) {
  if (!process.env.QR_TOKEN_SECRET) return { ok: false, reason: 'QR signing not configured' };
  if (!signature || !expiresAt) return { ok: false, reason: 'Missing QR signature' };

  if (Number(expiresAt) * 1000 < Date.now()) {
    return { ok: false, reason: 'QR code has expired, ask the passenger to rescan' };
  }

  const expected = signQrPayload(canonicalQrPayload({ tripId, seatNumbers, amount, expiresAt }));

  const provided = Buffer.from(String(signature), 'utf8');
  const computed = Buffer.from(expected, 'utf8');
  if (provided.length !== computed.length || !crypto.timingSafeEqual(provided, computed)) {
    return { ok: false, reason: 'QR signature does not match' };
  }

  return { ok: true };
}

// Socket.io Real-time connection with driver app
io.on('connection', (socket) => {
  console.log('📱 App connected via WebSocket:', socket.id);

  socket.on('join_trip', (tripId) => {
    if (tripId) {
      socket.join(tripId);
      console.log(`🚖 Driver listening for payments on trip: ${tripId}`);
    }
  });

  socket.on('disconnect', () => {
    console.log('App disconnected:', socket.id);
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    server: 'TaxiPay Backend',
    databaseConnected: dbConnected,
    timestamp: new Date().toISOString(),
  });
});

// Sync trip and seats when driver starts or updates trip
app.post('/api/trips/sync', async (req, res) => {
  const { trip, seats } = req.body;
  if (!trip || !trip.id) {
    return res.status(400).json({ error: 'Missing trip data' });
  }

  try {
    if (dbConnected) {
      await pool.query(
        `INSERT INTO trips (id, taxi_id, plate_number, route_name, fare_per_seat, currency, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         ON CONFLICT (id) DO UPDATE 
         SET plate_number = EXCLUDED.plate_number,
             route_name = EXCLUDED.route_name,
             fare_per_seat = EXCLUDED.fare_per_seat,
             updated_at = NOW()`,
        [trip.id, trip.taxiId, trip.plateNumber, trip.routeName, trip.farePerSeat, trip.currency || 'ETB']
      );

      if (Array.isArray(seats)) {
        for (const seat of seats) {
          await pool.query(
            `INSERT INTO seats (trip_id, seat_number, status, updated_at)
             VALUES ($1, $2, $3, NOW())
             ON CONFLICT (trip_id, seat_number) DO UPDATE
             SET status = EXCLUDED.status, updated_at = NOW()`,
            [trip.id, seat.seatNumber, seat.status]
          );
        }
      }
    } else {
      // In-memory fallback
      inMemorySeats.set(trip.id, seats || []);
    }

    res.json({ success: true, message: 'Trip synced successfully' });
  } catch (err) {
    console.error('Error syncing trip:', err);
    res.status(500).json({ error: err.message });
  }
});

// Mint a passenger payment link for one or more seats. The signature binds the
// link to this exact trip/seat-set/amount, so a leaked or edited QR cannot be
// replayed to mark different seats paid, and a group QR cannot be trimmed to
// pay for fewer seats than it was minted for.
app.get('/api/qr', (req, res) => {
  const { tripId, seats, seat, amount } = req.query;

  const seatNumbers = normalizeSeatNumbers(seats ?? seat);

  if (!tripId || seatNumbers.length === 0 || amount === undefined) {
    return res.status(400).json({ error: 'tripId, seat(s) and amount are required' });
  }

  const numericAmount = Number(amount);

  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    return res.status(400).json({ error: 'amount must be a positive number' });
  }

  try {
    const { signature, expiresAt } = issueQrToken({
      tripId: String(tripId),
      seatNumbers,
      amount: numericAmount,
    });

    const url = new URL('/pay', PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`);
    url.searchParams.set('tripId', String(tripId));
    url.searchParams.set('seats', seatNumbers.join(','));
    url.searchParams.set('amount', numericAmount.toFixed(2));
    url.searchParams.set('exp', String(expiresAt));
    url.searchParams.set('sig', signature);

    res.json({ url: url.toString(), expiresAt, seats: seatNumbers });
  } catch (err) {
    res.status(503).json({ error: err.message });
  }
});

// Telebirr / QR Payment Webhook: Called when customer pays. One payment may
// cover a single seat or, when one passenger pays for a group, several seats.
app.post(['/api/telebirr-webhook', '/api/pay'], async (req, res) => {
  const { tripId, seatNumber, seatNumbers, amount, payerPhone, transactionRef, sig, exp } = req.body;

  const seats = normalizeSeatNumbers(seatNumbers ?? seatNumber);

  if (!tripId || seats.length === 0) {
    return res.status(400).json({ error: 'tripId and seat(s) are required' });
  }

  // Never trust a caller-supplied amount: bind it to the seats' real fare from
  // the trips table so a tampered QR cannot record a 1 birr payment for a 40
  // birr seat. A group QR must cover the fare times the number of seats it was
  // minted for, so a leaked QR cannot pay for extra passengers for free.
  let perSeatAmount = Number(amount) / seats.length;
  let expectedAmount = Number(amount);
  try {
    if (dbConnected) {
      const trip = await pool.query('SELECT fare_per_seat FROM trips WHERE id = $1', [tripId]);
      if (trip.rows[0]) {
        perSeatAmount = Number(trip.rows[0].fare_per_seat);
        expectedAmount = Number((perSeatAmount * seats.length).toFixed(2));
      }
    }
  } catch (err) {
    console.error('Could not read fare for QR validation:', err.message);
    return res.status(500).json({ error: 'Could not validate payment amount' });
  }

  const check = verifyQrToken({
    tripId: String(tripId),
    seatNumbers: seats,
    amount: expectedAmount,
    expiresAt: exp,
    signature: sig,
  });

  if (!check.ok) {
    console.warn(`🚫 Rejected seat payment for trip ${tripId} seats ${seats.join(',')}: ${check.reason}`);
    return res.status(403).json({ error: check.reason });
  }

  const txRef = transactionRef || `TB-${Math.floor(100000 + Math.random() * 900000)}-ETB`;
  const paidAt = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const finalAmount = Number(expectedAmount);

  // The payments ledger keys each row on a unique transaction_ref. A single
  // Telebirr payment for a group therefore gets one row per seat, suffixed with
  // the seat number so the audit trail stays traceable but no row collides.
  const refForSeat = (seat) => (seats.length > 1 ? `${txRef}-S${seat}` : txRef);

  try {
    if (dbConnected) {
      // 0. A valid signature implies this trip was known when the QR was minted,
      //    but the seats table has a FK to trips so keep the row present.
      await pool.query(
        `INSERT INTO trips (id, taxi_id, plate_number, route_name, fare_per_seat)
         VALUES ($1, 'unknown', 'unknown', 'unknown', $2)
         ON CONFLICT (id) DO NOTHING`,
        [tripId, perSeatAmount]
      );

      for (const seat of seats) {
        // 1. Upsert seat to 'paid' in PostgreSQL
        await pool.query(
          `INSERT INTO seats (trip_id, seat_number, status, updated_at)
           VALUES ($1, $2, 'paid', NOW())
           ON CONFLICT (trip_id, seat_number) DO UPDATE
           SET status = 'paid', updated_at = NOW()`,
          [tripId, seat]
        );

        // 2. Insert into PostgreSQL payments ledger
        await pool.query(
          `INSERT INTO payments (trip_id, seat_number, amount, transaction_ref, payer_phone, status, paid_at)
           VALUES ($1, $2, $3, $4, $5, 'confirmed', NOW())
           ON CONFLICT (transaction_ref) DO NOTHING`,
          [tripId, seat, perSeatAmount, refForSeat(seat), payerPhone || '09xxxxxxxx']
        );
      }
    } else {
      for (const seat of seats) {
        inMemoryPayments.push({
          tripId,
          seatNumber: seat,
          amount: perSeatAmount,
          txRef: refForSeat(seat),
          paidAt,
        });
      }
    }

    // 3. Broadcast instant real-time notification to the driver's phone. For a
    //    group each seat gets its own event with a unique ref, so the driver app
    //    marks every seat paid and issues a receipt per passenger.
    for (const seat of seats) {
      const paymentPayload = {
        tripId,
        seatNumber: seat,
        amount: perSeatAmount,
        transactionRef: refForSeat(seat),
        payerPhone: payerPhone || 'Telebirr User',
        paidAt,
        provider: 'Telebirr (Verified)',
      };

      io.to(tripId).emit('seat_paid', paymentPayload);
      // Also broadcast globally as fallback in case tripId matching had slight string difference
      io.emit('seat_paid_broadcast', paymentPayload);
    }

    console.log(
      `💰 Payment Confirmed: ${seats.length > 1 ? `Seats #${seats.join(', #')}` : `Seat #${seats[0]}`} ` +
        `(Trip ${tripId}) - ${finalAmount} ETB - Ref: ${txRef}`,
    );

    res.json({
      success: true,
      transactionRef: txRef,
      paidAt,
      seats,
      message:
        seats.length > 1
          ? `Payment of ${finalAmount} ETB confirmed for ${seats.length} seats`
          : `Payment of ${finalAmount} ETB confirmed for seat #${seats[0]}`,
    });
  } catch (err) {
    console.error('Error recording payment:', err);
    res.status(500).json({ error: err.message });
  }
});

// Route for the checkout page
app.get('/pay', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ---------------------------------------------------------------------------
// Trip completion + 5 birr operator fee (Telebirr mandate / direct debit)
// ---------------------------------------------------------------------------

// Submit the mandate debit. This only moves the order to 'processing' -- it is
// NOT treated as proof of payment. A settlement becomes 'succeeded' only when
// Telebirr's signed notify_url callback says so, or when queryOrder confirms it.
async function submitMandateDebit(settlement, config) {
  const merchantOrderId = `FEE-${settlement.trip_id}-${Date.now()}`;

  const result = await telebirr.createMandateOrder(config, {
    merchantOrderId,
    amount: settlement.amount,
    title: `TaxiPay trip fee ${settlement.trip_id}`,
    notifyUrl: `${PUBLIC_BASE_URL}/api/telebirr/notify`,
    driverPhone: settlement.payer_phone,
  });

  const telebirrOrderId = result.prepayId || result.receiveCode || null;

  if (dbConnected) {
    await pool.query(
      `UPDATE settlements
          SET status = 'processing',
              merchant_order_id = $2,
              telebirr_order_id = $3,
              attempt_count = attempt_count + 1,
              failure_reason = NULL,
              updated_at = NOW()
        WHERE id = $1`,
      [settlement.id, merchantOrderId, telebirrOrderId]
    );
  }

  return { merchantOrderId, telebirrOrderId };
}

const SETTLEMENT_PATCHABLE = new Set([
  'status',
  'failure_reason',
  'telebirr_order_id',
  'merchant_order_id',
  'attempt_count',
  'paid_at',
]);

function markSettlement(settlementId, patch) {
  const entries = Object.entries(patch).filter(([key]) => SETTLEMENT_PATCHABLE.has(key));
  if (entries.length === 0) return Promise.resolve(null);

  const values = entries.map(([, value]) => value);
  const assignments = entries.map(([key], i) => `${key} = $${i + 1}`);

  if (!dbConnected) {
    const current = inMemorySettlements.get(settlementId) || {};
    const next = { ...current, ...Object.fromEntries(entries) };
    const key = current.trip_id || settlementId;
    inMemorySettlements.set(key, next);
    return Promise.resolve(next);
  }

  values.push(settlementId);
  return pool
    .query(
      `UPDATE settlements SET ${assignments.join(', ')}, updated_at = NOW()
        WHERE id = $${values.length} RETURNING *`,
      values,
    )
    .then((r) => r.rows[0]);
}


// Complete a trip: record the fee owed and try to collect it. Safe to call more
// than once -- the settlements table has UNIQUE(trip_id), so a repeated or
// concurrent request returns the existing settlement instead of charging again.
app.post('/api/trips/:tripId/complete', async (req, res) => {
  const tripId = req.params.tripId;
  const { driverPhone, feeAmount } = req.body || {};

  if (!driverPhone || !/^09\d{8}$/.test(String(driverPhone))) {
    return res.status(400).json({
      error: 'driverPhone is required and must be an Ethiopian mobile number (09xxxxxxxx)',
    });
  }

  const amount = Number.isFinite(Number(feeAmount)) ? Number(feeAmount) : DEFAULT_FEE_PER_TRIP;

  if (amount < 0) {
    return res.status(400).json({ error: 'feeAmount cannot be negative' });
  }

  try {
    let existing = null;

    if (dbConnected) {
      const trip = await pool.query(
        'SELECT id, fee_per_trip FROM trips WHERE id = $1',
        [tripId],
      );
      if (trip.rows[0]) {
        existing = await pool.query('SELECT * FROM settlements WHERE trip_id = $1', [tripId]);
        existing = existing.rows[0] || null;
      }

      await pool.query(
        `UPDATE trips SET status = 'completed', completed_at = NOW(), updated_at = NOW() WHERE id = $1`,
        [tripId],
      );

      if (!existing) {
        const inserted = await pool.query(
          `INSERT INTO settlements (trip_id, amount, payer_phone, payee_phone, status)
           VALUES ($1, $2, $3, $4, 'pending')
           ON CONFLICT (trip_id) DO NOTHING
           RETURNING *`,
          [tripId, amount, driverPhone, SETTLEMENT_PAYEE_PHONE],
        );
        existing = inserted.rows[0] || (await pool.query('SELECT * FROM settlements WHERE trip_id = $1', [tripId])).rows[0];
      }
    } else {
      existing = inMemorySettlements.get(tripId) || null;
      if (!existing) {
        existing = {
          id: Date.now(),
          trip_id: tripId,
          amount,
          payer_phone: driverPhone,
          payee_phone: SETTLEMENT_PAYEE_PHONE,
          status: 'pending',
          attempt_count: 0,
        };
        inMemorySettlements.set(tripId, existing);
      }
    }

    if (!existing) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    // Already collected, nothing to do.
    if (existing.status === 'succeeded') {
      return res.json({ settlement: existing, alreadySettled: true });
    }

    if (amount === 0) {
      return res.json({ settlement: existing, feeWaived: true });
    }

    const config = telebirr.loadConfig();
    const missing = telebirr.missingVars();

    if (missing.length > 0) {
      const reason = `Telebirr credentials not configured (missing: ${missing.join(', ')})`;
      const updated = await markSettlement(existing.id, {
        status: 'pending',
        failure_reason: reason,
      });
      console.warn(`⏸  Fee recorded but not collected: ${reason}`);
      return res.status(202).json({
        settlement: updated || existing,
        collected: false,
        reason,
      });
    }

    try {
      const order = await submitMandateDebit(existing, config);
      const refreshed = dbConnected
        ? (await pool.query('SELECT * FROM settlements WHERE id = $1', [existing.id])).rows[0]
        : { ...existing, status: 'processing', attempt_count: (existing.attempt_count || 0) + 1 };

      console.log(
        `💸 Fee submitted to Telebirr: ${existing.amount} ETB from ${existing.payer_phone} for trip ${tripId} (order ${order.merchantOrderId})`,
      );

      return res.status(202).json({
        settlement: refreshed,
        collected: false,
        awaitingConfirmation: true,
      });
    } catch (err) {
      const reason = err instanceof telebirr.TelebirrError ? err.message : String(err.message || err);
      const updated = await markSettlement(existing.id, {
        status: 'failed',
        failure_reason: reason,
        attempt_count: (existing.attempt_count || 0) + 1,
      });

      console.error(`❌ Fee collection failed for trip ${tripId}: ${reason}`);

      return res.status(502).json({
        settlement: updated || existing,
        collected: false,
        reason,
      });
    }
  } catch (err) {
    console.error('Error completing trip:', err);
    res.status(500).json({ error: err.message });
  }
});

// Telebirr server-to-server callback. Only a signature-verified notification, or a
// verified queryOrder, is allowed to mark a settlement paid.
app.post('/api/telebirr/notify', async (req, res) => {
  const body = req.body || {};
  const merchantOrderId = body.merch_order_id || body.merchOrderId;
  const tradeStatus = body.trade_status || body.tradeStatus;

  if (!merchantOrderId) {
    return res.status(400).json({ error: 'merch_order_id is required' });
  }

  const config = telebirr.loadConfig();

  if (!telebirr.isConfigured()) {
    return res.status(503).json({ error: 'Telebirr not configured' });
  }

  let valid = false;
  try {
    const signature = body.sign || req.get('x-telebirr-signature');
    valid = telebirr.verifyNotify(req.rawBody || JSON.stringify(body), signature, config.publicKey);
  } catch (err) {
    console.error('Notification signature check threw:', err.message);
    valid = false;
  }

  if (!valid) {
    console.warn(`🚫 Rejected unsigned/invalid Telebirr notification for ${merchantOrderId}`);
    return res.status(403).json({ error: 'Invalid signature' });
  }

  try {
    if (!dbConnected) {
      return res.json({ success: true, mode: 'in-memory' });
    }

    // Driver activation orders and per-trip fees share this callback, so route on
    // the order id prefix before looking in the settlements table.
    if (String(merchantOrderId).startsWith(`${ACCESS_ORDER_PREFIX}-`)) {
      const accessMatch = await pool.query(
        'SELECT * FROM driver_access WHERE merchant_order_id = $1',
        [merchantOrderId],
      );
      const accessRow = accessMatch.rows[0];

      if (!accessRow) {
        return res.json({ success: true, note: 'No activation request matches this order' });
      }

      if (accessRow.status === 'approved') {
        return res.json({ success: true, alreadyApproved: true });
      }

      if (tradeStatus !== 'PAY_SUCCESS') {
        const failed = await patchAccess(accessRow.phone, {
          status: 'failed',
          failure_reason: `Telebirr reported ${tradeStatus || 'unknown status'}`,
        });
        io.emit('access_updated', failed);
        return res.json({ success: true, access: failed });
      }

      const approved = await approveAccess(accessRow.phone, {
        paid: true,
        source: 'notify callback',
      });

      return res.json({ success: true, access: approved });
    }

    const found = await pool.query('SELECT * FROM settlements WHERE merchant_order_id = $1', [
      merchantOrderId,
    ]);
    const settlement = found.rows[0];

    if (!settlement) {
      return res.json({ success: true, note: 'No settlement matches this order' });
    }

    if (settlement.status === 'succeeded') {
      // Telebirr retries callbacks; a duplicate must not double-count.
      return res.json({ success: true, alreadySettled: true });
    }

    const succeeded = tradeStatus === 'PAY_SUCCESS';
    const updated = await pool.query(
      `UPDATE settlements
          SET status = $2,
              telebirr_order_id = COALESCE($3, telebirr_order_id),
              paid_at = CASE WHEN $2 = 'succeeded' THEN NOW() ELSE paid_at END,
              failure_reason = $4,
              updated_at = NOW()
        WHERE id = $1
        RETURNING *`,
      [
        settlement.id,
        succeeded ? 'succeeded' : 'failed',
        body.payment_order_id || null,
        succeeded ? null : `Telebirr reported ${tradeStatus || 'unknown status'}`,
      ],
    );

    if (succeeded) {
      console.log(`✅ Fee collected: ${settlement.amount} ETB for trip ${settlement.trip_id}`);
      io.to(settlement.trip_id).emit('settlement_updated', updated.rows[0]);
    }

    return res.json({ success: true, settlement: updated.rows[0] });
  } catch (err) {
    console.error('Error handling Telebirr notification:', err);
    res.status(500).json({ error: err.message });
  }
});

// Settlements list for the dashboard.
app.get('/api/settlements', async (req, res) => {
  try {
    if (!dbConnected) {
      return res.json({ settlements: Array.from(inMemorySettlements.values()) });
    }
    const result = await pool.query(
      'SELECT * FROM settlements ORDER BY created_at DESC LIMIT $1',
      [Number(req.query.limit) || 100],
    );
    res.json({ settlements: result.rows });
  } catch (err) {
    console.error('Error listing settlements:', err);
    res.status(500).json({ error: err.message });
  }
});

// Re-attempt a failed or pending fee. Same idempotency: a settled fee never
// gets a second order.
app.post('/api/settlements/:id/retry', async (req, res) => {
  const id = Number(req.params.id);

  try {
    if (!dbConnected) {
      return res.status(503).json({ error: 'Database not connected' });
    }

    const found = await pool.query('SELECT * FROM settlements WHERE id = $1', [id]);
    const settlement = found.rows[0];

    if (!settlement) return res.status(404).json({ error: 'Settlement not found' });
    if (settlement.status === 'succeeded') {
      return res.json({ settlement, alreadySettled: true });
    }

    const missing = telebirr.missingVars();
    if (missing.length > 0) {
      return res.status(202).json({
        collected: false,
        reason: `Telebirr credentials not configured (missing: ${missing.join(', ')})`,
      });
    }

    try {
      const order = await submitMandateDebit(settlement, telebirr.loadConfig());
      const refreshed = (await pool.query('SELECT * FROM settlements WHERE id = $1', [id])).rows[0];
      return res.status(202).json({ settlement: refreshed, awaitingConfirmation: true, order });
    } catch (err) {
      const reason = err instanceof telebirr.TelebirrError ? err.message : String(err.message || err);
      await markSettlement(id, { status: 'failed', failure_reason: reason });
      return res.status(502).json({ collected: false, reason });
    }
  } catch (err) {
    console.error('Error retrying settlement:', err);
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Driver access fee (one-time 5 birr that unlocks the app)
//
// State machine per phone:
//   unpaid -> pending -> processing -> approved
//                             |            ^
//                             +-> rejected +-> (re-applies and pays again)
//
// 'approved' is only written by approveAccess(), which is only ever called after
// Telebirr evidence: a signature-verified notify callback, a verified queryOrder,
// or an explicit owner decision on the admin endpoints. Nothing a client sends can
// reach it on its own.
// ---------------------------------------------------------------------------

function normalizePhone(value) {
  const digits = String(value || '').replace(/\s+/g, '');
  return /^09\d{8}$/.test(digits) ? digits : null;
}

// Owner PIN gate for the manual approve/revoke endpoints. The PIN lives only in the
// environment, is compared in constant time, and the routes refuse to work at all
// when it is unset rather than falling back to an open door.
function requireAdminPin(req, res) {
  const expected = process.env.ADMIN_PIN;

  if (!expected) {
    res.status(503).json({ error: 'ADMIN_PIN is not set on the server, owner endpoints are disabled' });
    return false;
  }

  const provided = String(
    (req.body && req.body.pin) || req.get('x-admin-pin') || '',
  );

  const expectedBuf = Buffer.from(expected, 'utf8');
  const providedBuf = Buffer.from(provided, 'utf8');

  if (
    expectedBuf.length !== providedBuf.length ||
    !crypto.timingSafeEqual(expectedBuf, providedBuf)
  ) {
    console.warn(`🚫 Rejected owner request with an incorrect PIN (${req.method} ${req.path})`);
    res.status(403).json({ error: 'Incorrect owner PIN' });
    return false;
  }

  return true;
}

async function findAccess(phone) {
  if (!dbConnected) {
    return inMemoryAccess.get(phone) || null;
  }
  const found = await pool.query('SELECT * FROM driver_access WHERE phone = $1', [phone]);
  return found.rows[0] || null;
}

// Create the row on first contact. The amount always comes from server config, so
// a client cannot ask for a cheaper unlock.
async function ensureAccess(phone) {
  const existing = await findAccess(phone);
  if (existing) return existing;

  if (!dbConnected) {
    const created = {
      phone,
      amount: ACCESS_FEE_AMOUNT,
      currency: 'ETB',
      status: 'unpaid',
      attempt_count: 0,
      created_at: new Date().toISOString(),
    };
    inMemoryAccess.set(phone, created);
    return created;
  }

  const inserted = await pool.query(
    `INSERT INTO driver_access (phone, amount, currency, status)
     VALUES ($1, $2, 'ETB', 'unpaid')
     ON CONFLICT (phone) DO NOTHING
     RETURNING *`,
    [phone, ACCESS_FEE_AMOUNT],
  );

  return inserted.rows[0] || (await findAccess(phone));
}

const ACCESS_PATCHABLE = new Set([
  'status',
  'merchant_order_id',
  'telebirr_order_id',
  'attempt_count',
  'failure_reason',
  'reviewed_by',
  'reviewed_at',
  'paid_at',
  'approved_at',
]);

async function patchAccess(phone, patch) {
  const entries = Object.entries(patch).filter(([key]) => ACCESS_PATCHABLE.has(key));
  if (entries.length === 0) return findAccess(phone);

  if (!dbConnected) {
    const current = inMemoryAccess.get(phone) || { phone, amount: ACCESS_FEE_AMOUNT };
    const next = { ...current, ...Object.fromEntries(entries) };
    inMemoryAccess.set(phone, next);
    return next;
  }

  const values = entries.map(([, value]) => value);
  const assignments = entries.map(([key], i) => `${key} = $${i + 1}`);
  values.push(phone);

  const updated = await pool.query(
    `UPDATE driver_access SET ${assignments.join(', ')}, updated_at = NOW()
      WHERE phone = $${values.length}
      RETURNING *`,
    values,
  );

  return updated.rows[0];
}

// The single writer of 'approved'. Callers pass the reason so the log records what
// unlocked the driver.
async function approveAccess(phone, { reviewedBy = null, paid = false, source } = {}) {
  const now = new Date().toISOString();

  // Only the columns this approval actually establishes are written. Sending a
  // null for paid_at/reviewed_at would erase the record of an earlier, genuine
  // payment the next time an owner re-approves the row.
  const patch = {
    status: 'approved',
    failure_reason: null,
    approved_at: now,
  };

  if (paid) patch.paid_at = now;
  if (reviewedBy) {
    patch.reviewed_by = reviewedBy;
    patch.reviewed_at = now;
  }

  const approved = await patchAccess(phone, patch);

  if (approved) {
    console.log(`🔓 Access approved for ${phone} (${source || 'unknown source'})`);
    io.emit('access_updated', approved);
  }

  return approved;
}

function accessIsCollectible() {
  const missing = telebirr.missingVars();
  if (missing.length > 0) {
    return {
      ok: false,
      reason: `Telebirr credentials not configured (missing: ${missing.join(', ')})`,
    };
  }

  if (!telebirr.loadConfig().contractNo) {
    return {
      ok: false,
      reason:
        'TELEBIRR_MANDATE_CONTRACT_NO is not set, so the access fee cannot be charged.',
    };
  }

  return { ok: true };
}

app.get('/api/access/status', async (req, res) => {
  const phone = normalizePhone(req.query.phone);

  if (!phone) {
    return res.status(400).json({
      error: 'phone is required and must be an Ethiopian mobile number (09xxxxxxxx)',
    });
  }

  try {
    const access = await findAccess(phone);

    res.json({
      phone,
      access,
      approved: Boolean(access && access.status === 'approved'),
      amount: ACCESS_FEE_AMOUNT,
      payeePhone: SETTLEMENT_PAYEE_PHONE,
      telebirrConfigured: accessIsCollectible().ok,
    });
  } catch (err) {
    console.error('Error reading access status:', err);
    res.status(500).json({ error: err.message });
  }
});

// Start the activation payment. This only puts the request into 'processing'; it is
// not proof of payment. Money has moved when the notify callback or a queryOrder
// says PAY_SUCCESS, and only then does approveAccess() run.
app.post('/api/access/pay', async (req, res) => {
  const phone = normalizePhone((req.body || {}).phone);

  if (!phone) {
    return res.status(400).json({
      error: 'phone is required and must be an Ethiopian mobile number (09xxxxxxxx)',
    });
  }

  try {
    const access = await ensureAccess(phone);

    if (access && access.status === 'approved') {
      return res.json({ access, alreadyApproved: true, approved: true });
    }

    const collectible = accessIsCollectible();
    if (!collectible.ok) {
      const pending = await patchAccess(phone, {
        status: 'pending',
        failure_reason: collectible.reason,
      });
      console.warn(`⏸  Access fee not collected for ${phone}: ${collectible.reason}`);
      return res.status(202).json({ access: pending, collected: false, reason: collectible.reason });
    }

    const merchantOrderId = `${ACCESS_ORDER_PREFIX}-${phone}-${Date.now()}`;

    const order = await telebirr.createMandateOrder(telebirr.loadConfig(), {
      merchantOrderId,
      amount: access ? access.amount : ACCESS_FEE_AMOUNT,
      title: `TaxiPay activation fee ${phone}`,
      notifyUrl: `${PUBLIC_BASE_URL}/api/telebirr/notify`,
      driverPhone: phone,
    });

    const processing = await patchAccess(phone, {
      status: 'processing',
      merchant_order_id: merchantOrderId,
      telebirr_order_id: order.prepayId || order.receiveCode || null,
      attempt_count: Number((access && access.attempt_count) || 0) + 1,
      failure_reason: null,
    });

    console.log(
      `🔐 Activation fee submitted to Telebirr: ${ACCESS_FEE_AMOUNT} ETB from ${phone} (order ${merchantOrderId})`,
    );

    return res.status(202).json({
      access: processing,
      collected: false,
      awaitingConfirmation: true,
    });
  } catch (err) {
    const reason =
      err instanceof telebirr.TelebirrError
        ? err.message
        : String((err && err.message) || err);
    const failed = await patchAccess(phone, { status: 'failed', failure_reason: reason });

    console.error(`❌ Activation fee failed for ${phone}: ${reason}`);

    return res.status(502).json({ access: failed, collected: false, reason });
  }
});

// Fallback for when the notify callback never arrives (PUBLIC_BASE_URL unset, or a
// dropped callback). Asks Telebirr directly, and checks the returned amount against
// the row so a smaller payment cannot unlock the app.
app.post('/api/access/check', async (req, res) => {
  const phone = normalizePhone((req.body || {}).phone);

  if (!phone) {
    return res.status(400).json({
      error: 'phone is required and must be an Ethiopian mobile number (09xxxxxxxx)',
    });
  }

  try {
    const access = await findAccess(phone);

    if (!access) {
      return res.status(404).json({ error: 'No activation request for this number yet' });
    }

    if (access.status === 'approved') {
      return res.json({ access, approved: true });
    }

    if (!access.merchant_order_id) {
      return res.json({
        access,
        approved: false,
        reason: 'No Telebirr order has been created yet. Tap pay first.',
      });
    }

    const collectible = accessIsCollectible();
    if (!collectible.ok) {
      return res.status(202).json({ access, approved: false, reason: collectible.reason });
    }

    const order = await telebirr.queryOrder(telebirr.loadConfig(), {
      merchantOrderId: access.merchant_order_id,
    });

    const succeeded = order.tradeStatus === 'PAY_SUCCESS';

    if (!succeeded) {
      return res.json({
        access,
        approved: false,
        reason: `Telebirr has not confirmed the payment yet (${order.tradeStatus || 'unknown status'}).`,
      });
    }

    const paidAmount = Number(order.amount);
    if (Number.isFinite(paidAmount) && paidAmount !== Number(access.amount)) {
      const rejected = await patchAccess(phone, {
        status: 'failed',
        failure_reason: `Telebirr confirmed ${paidAmount} ETB but ${access.amount} ETB was required`,
      });
      return res.status(409).json({
        access: rejected,
        approved: false,
        reason: `Amount mismatch: paid ${paidAmount} ETB, required ${access.amount} ETB.`,
      });
    }

    const approved = await approveAccess(phone, { paid: true, source: 'queryOrder' });
    return res.json({ access: approved, approved: true });
  } catch (err) {
    const reason =
      err instanceof telebirr.TelebirrError
        ? err.message
        : String((err && err.message) || err);
    console.error(`Could not query activation order for ${phone}: ${reason}`);
    return res.status(502).json({ reason });
  }
});

// Owner endpoints: manual approve or revoke, for when a driver paid outside the
// app or needs to be locked out again.
app.get('/api/admin/access', async (req, res) => {
  if (!requireAdminPin(req, res)) return;

  try {
    if (!dbConnected) {
      return res.json({ access: Array.from(inMemoryAccess.values()) });
    }
    const result = await pool.query(
      'SELECT * FROM driver_access ORDER BY updated_at DESC LIMIT 200',
    );
    res.json({ access: result.rows, amount: ACCESS_FEE_AMOUNT, payeePhone: SETTLEMENT_PAYEE_PHONE });
  } catch (err) {
    console.error('Error listing access requests:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/access/:phone/approve', async (req, res) => {
  if (!requireAdminPin(req, res)) return;

  const phone = normalizePhone(req.params.phone);
  if (!phone) {
    return res.status(400).json({ error: 'phone must be 09xxxxxxxx' });
  }

  try {
    await ensureAccess(phone);
    const approved = await approveAccess(phone, { reviewedBy: 'owner', source: 'owner' });
    res.json({ access: approved });
  } catch (err) {
    console.error('Error approving access:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/access/:phone/revoke', async (req, res) => {
  if (!requireAdminPin(req, res)) return;

  const phone = normalizePhone(req.params.phone);
  if (!phone) {
    return res.status(400).json({ error: 'phone must be 09xxxxxxxx' });
  }

  const reason = String((req.body || {}).reason || '').trim() || 'Revoked by owner';

  try {
    await ensureAccess(phone);
    const revoked = await patchAccess(phone, {
      status: 'rejected',
      failure_reason: reason,
      reviewed_by: 'owner',
      reviewed_at: new Date().toISOString(),
    });

    console.log(`🔒 Access revoked for ${phone}: ${reason}`);
    io.emit('access_updated', revoked);

    res.json({ access: revoked });
  } catch (err) {
    console.error('Error revoking access:', err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  const missing = telebirr.missingVars();
  console.log(`\n========================================`);
  console.log(`🚕 TaxiPay Realtime Payment Server Online`);
  console.log(`📡 Listening on http://0.0.0.0:${PORT}`);
  console.log(`💳 Passenger Checkout: http://localhost:${PORT}/pay`);
  console.log(`💸 Fee per trip: ${DEFAULT_FEE_PER_TRIP} ETB -> ${SETTLEMENT_PAYEE_PHONE}`);
  console.log(`🔐 Activation fee: ${ACCESS_FEE_AMOUNT} ETB (app locked until approved)`);
  if (missing.length === 0) {
    console.log(`🏦 Telebirr: configured (${telebirr.loadConfig().environment})`);
  } else {
    console.log(`🏦 Telebirr: NOT configured -- fees will be recorded as pending, not collected.`);
    console.log(`   Missing: ${missing.join(', ')}`);
  }
  if (!process.env.QR_TOKEN_SECRET) {
    console.log(`⚠️  QR_TOKEN_SECRET unset -- seat payments will be rejected.`);
  }
  if (!process.env.ADMIN_PIN) {
    console.log(`⚠️  ADMIN_PIN unset -- in-app owner approve/revoke is disabled.`);
  }
  console.log(`========================================\n`);
});

