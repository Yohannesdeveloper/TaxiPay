import { AccessState, AccessStatus, DriverAccess } from '../../types';
import { socketService } from '../socket/socketService';

interface RawAccess {
  phone: string;
  amount: string | number;
  currency: string;
  status: string;
  merchant_order_id: string | null;
  telebirr_order_id: string | null;
  attempt_count: number;
  failure_reason: string | null;
  reviewed_at: string | null;
  paid_at: string | null;
  approved_at: string | null;
  created_at: string;
}

const VALID_STATUSES: AccessStatus[] = ['unpaid', 'pending', 'processing', 'approved', 'rejected'];

function toStatus(raw: string | undefined): AccessStatus {
  return VALID_STATUSES.includes(raw as AccessStatus) ? (raw as AccessStatus) : 'unpaid';
}

function toDriverAccess(raw: RawAccess): DriverAccess {
  return {
    phone: raw.phone,
    amount: Number(raw.amount),
    currency: raw.currency || 'ETB',
    status: toStatus(raw.status),
    merchantOrderId: raw.merchant_order_id || undefined,
    telebirrOrderId: raw.telebirr_order_id || undefined,
    attemptCount: Number(raw.attempt_count) || 0,
    failureReason: raw.failure_reason || undefined,
    reviewedAt: raw.reviewed_at || undefined,
    paidAt: raw.paid_at || undefined,
    approvedAt: raw.approved_at || undefined,
    createdAt: raw.created_at,
  };
}

// No phone is requested yet: stay locked, with no fee assumptions beyond the
// server's own configured default once we do know the number.
const UNKNOWN_STATE: AccessState = {
  phone: '',
  status: 'unpaid',
  amount: 0,
  payeePhone: '',
  telebirrConfigured: false,
  attemptCount: 0,
};

async function request<T>(path: string, init: RequestInit): Promise<{ status: number; data: T }> {
  const res = await fetch(`${socketService.getServerUrl()}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
  });

  let data: T;
  try {
    data = (await res.json()) as T;
  } catch {
    data = {} as T;
  }

  return { status: res.status, data };
}

function toAccessState(
  phone: string,
  raw: RawAccess | null | undefined,
  fallback: Pick<AccessState, 'amount' | 'payeePhone' | 'telebirrConfigured'>,
): AccessState {
  if (!raw) {
    return {
      ...UNKNOWN_STATE,
      phone,
      amount: fallback.amount,
      payeePhone: fallback.payeePhone,
      telebirrConfigured: fallback.telebirrConfigured,
    };
  }

  const mapped = toDriverAccess(raw);
  return {
    phone,
    status: mapped.status,
    amount: mapped.amount,
    payeePhone: fallback.payeePhone,
    telebirrConfigured: fallback.telebirrConfigured,
    failureReason: mapped.failureReason,
    attemptCount: mapped.attemptCount,
    paidAt: mapped.paidAt,
    approvedAt: mapped.approvedAt,
  };
}

interface StatusResponse {
  access?: RawAccess | null;
  approved?: boolean;
  amount?: number;
  payeePhone?: string;
  telebirrConfigured?: boolean;
  error?: string;
}

export async function fetchAccessStatus(phone: string): Promise<AccessState> {
  const { data } = await request<StatusResponse>(
    `/api/access/status?phone=${encodeURIComponent(phone)}`,
    { method: 'GET' },
  );

  return toAccessState(phone, data.access, {
    amount: Number(data.amount) || 0,
    payeePhone: data.payeePhone || '',
    telebirrConfigured: Boolean(data.telebirrConfigured),
  });
}

export interface PayAccessResult {
  state: AccessState | null;
  awaitingConfirmation: boolean;
  alreadyApproved: boolean;
  reason?: string;
}

export async function payAccessFee(phone: string): Promise<PayAccessResult> {
  const { data } = await request<StatusResponse & { awaitingConfirmation?: boolean; alreadyApproved?: boolean; reason?: string }>(
    '/api/access/pay',
    { method: 'POST', body: JSON.stringify({ phone }) },
  );

  if (data.error && !data.access) {
    throw new Error(data.error);
  }

  const state = data.access
    ? toAccessState(phone, data.access, {
        amount: Number(data.access.amount) || 0,
        payeePhone: '',
        telebirrConfigured: true,
      })
    : null;

  return {
    state,
    awaitingConfirmation: Boolean(data.awaitingConfirmation),
    alreadyApproved: Boolean(data.alreadyApproved),
    reason: data.reason,
  };
}

export interface CheckAccessResult {
  state: AccessState | null;
  approved: boolean;
  reason?: string;
}

// Asks the server to query Telebirr directly. The server only answers `approved`
// when Telebirr reports PAY_SUCCESS for the exact amount.
export async function verifyAccessPayment(phone: string): Promise<CheckAccessResult> {
  const { status, data } = await request<StatusResponse & { reason?: string }>(
    '/api/access/check',
    { method: 'POST', body: JSON.stringify({ phone }) },
  );

  if (status >= 500 && !data.access) {
    throw new Error(data.reason || 'Could not reach the payment server.');
  }

  return {
    state: data.access
      ? toAccessState(phone, data.access, {
          amount: Number(data.access.amount) || 0,
          payeePhone: '',
          telebirrConfigured: true,
        })
      : null,
    approved: Boolean(data.approved),
    reason: data.reason,
  };
}

export async function fetchAccessAdminList(pin: string): Promise<DriverAccess[]> {
  const { status, data } = await request<{ access?: RawAccess[]; error?: string }>(
    '/api/admin/access',
    { method: 'GET', headers: { 'x-admin-pin': pin } },
  );

  if (status === 403) throw new Error('Incorrect owner PIN');
  if (status === 503) throw new Error(data.error || 'Owner PIN is not set on the server.');
  if (status >= 400) throw new Error(data.error || `Request failed with status ${status}`);

  return (data.access || []).map(toDriverAccess);
}

async function adminAction(
  phone: string,
  action: 'approve' | 'revoke',
  pin: string,
  reason?: string,
): Promise<DriverAccess | null> {
  const { status, data } = await request<{ access?: RawAccess; error?: string }>(
    `/api/admin/access/${encodeURIComponent(phone)}/${action}`,
    { method: 'POST', body: JSON.stringify({ pin, reason }) },
  );

  if (status === 403) throw new Error('Incorrect owner PIN');
  if (status >= 400) throw new Error(data.error || `Request failed with status ${status}`);

  return data.access ? toDriverAccess(data.access) : null;
}

export function adminApproveAccess(phone: string, pin: string): Promise<DriverAccess | null> {
  return adminAction(phone, 'approve', pin);
}

export function adminRevokeAccess(phone: string, pin: string, reason?: string): Promise<DriverAccess | null> {
  return adminAction(phone, 'revoke', pin, reason);
}
