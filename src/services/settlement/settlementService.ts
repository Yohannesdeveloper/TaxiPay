import { Settlement, SettlementStatus } from '../../types';
import { socketService } from '../socket/socketService';

interface RawSettlement {
  id: number;
  trip_id: string;
  amount: string | number;
  currency: string;
  payer_phone: string;
  payee_phone: string;
  status: string;
  failure_reason: string | null;
  merchant_order_id: string | null;
  telebirr_order_id: string | null;
  attempt_count: number;
  paid_at: string | null;
  created_at: string;
}

export interface CompleteTripResult {
  settlement?: Settlement;
  collected: boolean;
  awaitingConfirmation?: boolean;
  feeWaived?: boolean;
  alreadySettled?: boolean;
  reason?: string;
}

const VALID_STATUSES: SettlementStatus[] = ['pending', 'processing', 'succeeded', 'failed'];

function toSettlement(raw: RawSettlement): Settlement {
  return {
    id: Number(raw.id),
    tripId: raw.trip_id,
    amount: Number(raw.amount),
    currency: raw.currency || 'ETB',
    payerPhone: raw.payer_phone,
    payeePhone: raw.payee_phone,
    status: VALID_STATUSES.includes(raw.status as SettlementStatus)
      ? (raw.status as SettlementStatus)
      : 'pending',
    failureReason: raw.failure_reason || undefined,
    merchantOrderId: raw.merchant_order_id || undefined,
    telebirrOrderId: raw.telebirr_order_id || undefined,
    attemptCount: Number(raw.attempt_count) || 0,
    paidAt: raw.paid_at || undefined,
    createdAt: raw.created_at,
  };
}

async function post<T>(path: string, body: unknown): Promise<{ status: number; data: T }> {
  const res = await fetch(`${socketService.getServerUrl()}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  let data: T;
  try {
    data = (await res.json()) as T;
  } catch {
    data = {} as T;
  }

  return { status: res.status, data };
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${socketService.getServerUrl()}${path}`);
  if (!res.ok) throw new Error(`Request failed with status ${res.status}`);
  return (await res.json()) as T;
}

// End the trip and collect the operator fee. The server records the fee as owed
// and attempts the Telebirr mandate debit; `collected` is false whenever the
// money has not actually moved, which is the normal case until the driver's
// mandate is set up.
export async function completeTrip(params: {
  tripId: string;
  driverPhone: string;
  feeAmount?: number;
}): Promise<CompleteTripResult> {
  const { status, data } = await post<{
    settlement?: RawSettlement;
    collected?: boolean;
    awaitingConfirmation?: boolean;
    feeWaived?: boolean;
    alreadySettled?: boolean;
    reason?: string;
    error?: string;
  }>(`/api/trips/${encodeURIComponent(params.tripId)}/complete`, {
    driverPhone: params.driverPhone,
    feeAmount: params.feeAmount,
  });

  if (!data.settlement && data.error) {
    throw new Error(data.error);
  }

  // 4xx means the request was rejected; anything else with a settlement body
  // means the fee was recorded but not collected.
  if (status >= 500 && !data.settlement) {
    throw new Error(data.reason || 'Could not reach the payment server.');
  }

  return {
    settlement: data.settlement ? toSettlement(data.settlement) : undefined,
    collected: Boolean(data.collected),
    awaitingConfirmation: Boolean(data.awaitingConfirmation),
    feeWaived: Boolean(data.feeWaived),
    alreadySettled: Boolean(data.alreadySettled),
    reason: data.reason,
  };
}

export async function fetchSettlements(limit = 50): Promise<Settlement[]> {
  const data = await get<{ settlements: RawSettlement[] }>(`/api/settlements?limit=${limit}`);
  return (data.settlements || []).map(toSettlement);
}

export async function retrySettlement(id: number): Promise<CompleteTripResult> {
  const { status, data } = await post<{
    settlement?: RawSettlement;
    collected?: boolean;
    awaitingConfirmation?: boolean;
    alreadySettled?: boolean;
    reason?: string;
    error?: string;
  }>(`/api/settlements/${id}/retry`, {});

  if (!data.settlement && data.error) {
    throw new Error(data.error);
  }

  return {
    settlement: data.settlement ? toSettlement(data.settlement) : undefined,
    collected: Boolean(data.collected),
    awaitingConfirmation: Boolean(data.awaitingConfirmation),
    alreadySettled: Boolean(data.alreadySettled),
    reason: data.reason,
  };
}
