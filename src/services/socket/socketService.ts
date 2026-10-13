import { io, Socket } from 'socket.io-client';
import { Platform } from 'react-native';
import { LivePaymentEvent, Trip, Seat, Settlement, DriverAccess, AccessStatus } from '../../types';

import Constants from 'expo-constants';

// Live 24/7 Railway Server URL
const RAILWAY_PRODUCTION_URL = 'https://taxipay-production.up.railway.app';

function resolveDefaultServerUrl(): string {
  // Always use the live Railway cloud server so mobile phones, 
  // Expo tunnels, cellular 4G, and web clients connect seamlessly worldwide.
  return RAILWAY_PRODUCTION_URL;
}

const DEFAULT_SERVER_URL = resolveDefaultServerUrl();

const ACCESS_STATUSES: AccessStatus[] = ['unpaid', 'pending', 'processing', 'approved', 'rejected'];

// The server sends the raw row over the socket, so an unrecognised status must
// never be passed through as-is: an unknown value would fail the locked/unlocked
// comparison and could leave a driver stuck on the lock screen.
function toAccessStatus(raw: string): AccessStatus {
  return ACCESS_STATUSES.includes(raw as AccessStatus) ? (raw as AccessStatus) : 'unpaid';
}

interface RawSettlement {
  id: number;
  trip_id: string;
  amount: string | number;
  currency: string;
  payer_phone: string;
  payee_phone: string;
  status: Settlement['status'];
  failure_reason: string | null;
  merchant_order_id: string | null;
  telebirr_order_id: string | null;
  attempt_count: number;
  paid_at: string | null;
  created_at: string;
}

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

class TaxiSocketService {
  private socket: Socket | null = null;
  private currentTripId: string | null = null;
  private serverUrl: string = DEFAULT_SERVER_URL;
  private paymentListeners: Set<(payment: LivePaymentEvent) => void> = new Set();
  private settlementListeners: Set<(settlement: Settlement) => void> = new Set();
  private accessListeners: Set<(access: DriverAccess) => void> = new Set();
  private isConnecting: boolean = false;

  public setServerUrl(url: string) {
    if (url && url !== this.serverUrl) {
      this.serverUrl = url;
      if (this.socket) {
        this.disconnect();
        this.connect();
      }
    }
  }

  public getServerUrl(): string {
    return this.serverUrl;
  }

  public connect(url?: string): Socket {
    if (url) {
      this.serverUrl = url;
    }

    if (this.socket && this.socket.connected) {
      return this.socket;
    }

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.isConnecting = true;
    console.log(`[TaxiSocket] Connecting to ${this.serverUrl}...`);

    this.socket = io(this.serverUrl, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      timeout: 10000,
    });

    this.socket.on('connect', () => {
      console.log('[TaxiSocket] Connected successfully:', this.socket?.id);
      this.isConnecting = false;
      if (this.currentTripId) {
        this.joinTrip(this.currentTripId);
      }
    });

    this.socket.on('connect_error', (err) => {
      console.warn('[TaxiSocket] Connection notice:', err.message);
      this.isConnecting = false;
    });

    // Handle seat_paid event
    this.socket.on('seat_paid', (data: LivePaymentEvent) => {
      console.log('[TaxiSocket] Realtime payment received:', data);
      this.notifyPaymentListeners(data);
    });

    this.socket.on('seat_paid_broadcast', (data: LivePaymentEvent) => {
      if (!this.currentTripId || data.tripId === this.currentTripId) {
        console.log('[TaxiSocket] Broadcast payment received:', data);
        this.notifyPaymentListeners(data);
      }
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[TaxiSocket] Disconnected:', reason);
    });

    // Emitted when Telebirr confirms a mandate debit via the verified callback.
    this.socket.on('settlement_updated', (data: RawSettlement) => {
      const settlement = this.toSettlement(data);
      if (settlement) {
        console.log('[TaxiSocket] Fee collection updated:', settlement.status);
        this.settlementListeners.forEach((listener) => {
          try {
            listener(settlement);
          } catch (err) {
            console.error('[TaxiSocket] Error in settlement listener:', err);
          }
        });
      }
    });

    // Emitted when the server approves or revokes a driver's app access. The lock
    // screen is mounted before the dashboard exists, so it subscribes to this
    // directly instead of waiting for a socket it would otherwise never open.
    this.socket.on('access_updated', (data: RawAccess) => {
      const access = this.toDriverAccess(data);
      if (access) {
        console.log('[TaxiSocket] App access updated:', access.phone, access.status);
        this.accessListeners.forEach((listener) => {
          try {
            listener(access);
          } catch (err) {
            console.error('[TaxiSocket] Error in access listener:', err);
          }
        });
      }
    });

    return this.socket;
  }

  public joinTrip(tripId: string) {
    this.currentTripId = tripId;
    if (this.socket && this.socket.connected) {
      this.socket.emit('join_trip', tripId);
      console.log(`[TaxiSocket] Joined room for trip: ${tripId}`);
    }
  }

  public async syncTripWithServer(trip: Trip, seats: Seat[]): Promise<boolean> {
    try {
      const response = await fetch(`${this.serverUrl}/api/trips/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trip, seats }),
      });
      return response.ok;
    } catch (e) {
      // Offline or server not yet reachable; gracefully ignore
      return false;
    }
  }

  public onPaymentReceived(callback: (payment: LivePaymentEvent) => void): () => void {
    this.paymentListeners.add(callback);
    return () => {
      this.paymentListeners.delete(callback);
    };
  }

  public onSettlementUpdated(callback: (settlement: Settlement) => void): () => void {
    this.settlementListeners.add(callback);
    return () => {
      this.settlementListeners.delete(callback);
    };
  }

  public onAccessUpdated(callback: (access: DriverAccess) => void): () => void {
    this.accessListeners.add(callback);
    return () => {
      this.accessListeners.delete(callback);
    };
  }

  // The server emits settlement rows straight from Postgres, so they arrive
  // snake_cased and with NUMERIC as a string.
  private toSettlement(raw: RawSettlement): Settlement | null {
    if (!raw || !raw.id) return null;
    return {
      id: Number(raw.id),
      tripId: raw.trip_id,
      amount: Number(raw.amount),
      currency: raw.currency || 'ETB',
      payerPhone: raw.payer_phone,
      payeePhone: raw.payee_phone,
      status: raw.status,
      failureReason: raw.failure_reason || undefined,
      merchantOrderId: raw.merchant_order_id || undefined,
      telebirrOrderId: raw.telebirr_order_id || undefined,
      attemptCount: Number(raw.attempt_count) || 0,
      paidAt: raw.paid_at || undefined,
      createdAt: raw.created_at,
    };
  }

  private toDriverAccess(raw: RawAccess): DriverAccess | null {
    if (!raw || !raw.phone) return null;
    return {
      phone: raw.phone,
      amount: Number(raw.amount),
      currency: raw.currency || 'ETB',
      status: toAccessStatus(raw.status),
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

  private notifyPaymentListeners(payment: LivePaymentEvent) {
    this.paymentListeners.forEach((listener) => {
      try {
        listener(payment);
      } catch (err) {
        console.error('[TaxiSocket] Error in payment listener:', err);
      }
    });
  }

  public disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  public isConnected(): boolean {
    return !!(this.socket && this.socket.connected);
  }
}

export const socketService = new TaxiSocketService();
