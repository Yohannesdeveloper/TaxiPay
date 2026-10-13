import { IPaymentService, CreatePaymentRequestParams, PaymentVerificationResult } from './types';
import { PaymentAttempt } from '../../types';

import { socketService } from '../socket/socketService';

class MockTelebirrPaymentService implements IPaymentService {
  private attempts: Map<string, PaymentAttempt> = new Map();
  private confirmedTransactions: Set<string> = new Set();

  public async createPaymentRequest(params: CreatePaymentRequestParams): Promise<PaymentAttempt> {
    const timestamp = new Date().toISOString();
    const seats = [...params.seatNumbers].sort((a, b) => a - b);
    const seatLabel = seats.join(',');
    const totalAmount = params.farePerSeat * seats.length;
    const attemptId = `ATTEMPT-${params.tripId.slice(-4)}-S${seatLabel}-${Date.now().toString().slice(-6)}`;

    // The QR link must be signed by the server: /api/pay rejects any request whose
    // signature does not match this exact trip/seat-set/amount. Building the URL
    // here would produce an unsigned link that the payment endpoint now refuses.
    const serverUrl = socketService.getServerUrl();
    const qrPayloadString = await this.requestSignedQrUrl({
      serverUrl,
      tripId: params.tripId,
      seatNumbers: seats,
      amount: totalAmount,
    });

    const attempt: PaymentAttempt = {
      id: attemptId,
      taxiId: params.taxiId,
      tripId: params.tripId,
      seatId: params.seatIds.join(','),
      seatNumber: seats[0],
      seatNumbers: seats,
      fare: totalAmount,
      currency: params.currency,
      timestamp,
      status: qrPayloadString ? 'pending' : 'offline',
      provider: 'telebirr_mock',
      qrPayloadString,
      errorMessage: qrPayloadString
        ? undefined
        : 'Could not reach the payment server to issue a signed QR code.',
    };

    this.attempts.set(attemptId, attempt);
    return attempt;
  }

  private async requestSignedQrUrl(params: {
    serverUrl: string;
    tripId: string;
    seatNumbers: number[];
    amount: number;
  }): Promise<string> {
    const query = new URLSearchParams({
      tripId: params.tripId,
      seats: params.seatNumbers.join(','),
      amount: params.amount.toFixed(2),
    });

    try {
      const res = await fetch(`${params.serverUrl}/api/qr?${query.toString()}`);
      if (!res.ok) return '';
      const data = await res.json();
      return typeof data.url === 'string' ? data.url : '';
    } catch {
      return '';
    }
  }

  public async checkPaymentStatus(attemptId: string): Promise<PaymentVerificationResult> {
    const attempt = this.attempts.get(attemptId);
    if (!attempt) {
      return {
        attemptId,
        status: 'failed',
        errorMessage: 'Payment attempt not found on verification server.',
      };
    }

    return {
      attemptId: attempt.id,
      status: attempt.status,
      transactionRef: attempt.transactionRef,
      confirmedAt: attempt.status === 'confirmed' ? attempt.timestamp : undefined,
      errorMessage: attempt.errorMessage,
    };
  }

  public async simulateScanAndPay(attemptId: string): Promise<PaymentVerificationResult> {
    const attempt = this.attempts.get(attemptId);
    if (!attempt) {
      throw new Error('Payment attempt not found');
    }

    // Check idempotency - prevent double payment processing
    if (this.confirmedTransactions.has(attemptId)) {
      return {
        attemptId,
        status: 'confirmed',
        transactionRef: attempt.transactionRef,
        confirmedAt: attempt.timestamp,
      };
    }

    // Simulate verified confirmation from backend
    const txRef = `TB-SIM-${Math.floor(100000 + Math.random() * 900000)}-ETB`;
    attempt.status = 'confirmed';
    attempt.transactionRef = txRef;
    this.confirmedTransactions.add(attemptId);
    this.attempts.set(attemptId, attempt);

    return {
      attemptId,
      status: 'confirmed',
      transactionRef: txRef,
      confirmedAt: new Date().toISOString(),
    };
  }

  public async simulateFailure(attemptId: string, reason = 'Insufficient passenger telebirr balance'): Promise<PaymentVerificationResult> {
    const attempt = this.attempts.get(attemptId);
    if (!attempt) throw new Error('Payment attempt not found');

    attempt.status = 'failed';
    attempt.errorMessage = reason;
    this.attempts.set(attemptId, attempt);

    return {
      attemptId,
      status: 'failed',
      errorMessage: reason,
    };
  }

  public async simulateTimeout(attemptId: string): Promise<PaymentVerificationResult> {
    const attempt = this.attempts.get(attemptId);
    if (!attempt) throw new Error('Payment attempt not found');

    attempt.status = 'expired';
    attempt.errorMessage = 'QR session expired after timeout';
    this.attempts.set(attemptId, attempt);

    return {
      attemptId,
      status: 'expired',
      errorMessage: 'QR session expired after timeout',
    };
  }
}

export const paymentService: IPaymentService = new MockTelebirrPaymentService();
