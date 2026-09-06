import { IPaymentService, CreatePaymentRequestParams, PaymentVerificationResult } from './types';
import { PaymentAttempt } from '../../types';

import { socketService } from '../socket/socketService';

class MockTelebirrPaymentService implements IPaymentService {
  private attempts: Map<string, PaymentAttempt> = new Map();
  private confirmedTransactions: Set<string> = new Set();

  public async createPaymentRequest(params: CreatePaymentRequestParams): Promise<PaymentAttempt> {
    const timestamp = new Date().toISOString();
    const attemptId = `ATTEMPT-${params.tripId.slice(-4)}-S${params.seatNumber}-${Date.now().toString().slice(-6)}`;
    
    // Live Passenger Checkout URL: scanning with any phone camera opens the Telebirr payment portal
    const serverUrl = socketService.getServerUrl();
    const qrPayloadString = `${serverUrl}/pay?tripId=${encodeURIComponent(params.tripId)}&seat=${params.seatNumber}&fare=${params.fareAmount}&currency=${encodeURIComponent(params.currency)}`;

    const attempt: PaymentAttempt = {
      id: attemptId,
      taxiId: params.taxiId,
      tripId: params.tripId,
      seatId: params.seatId,
      seatNumber: params.seatNumber,
      fare: params.fareAmount,
      currency: params.currency,
      timestamp,
      status: 'pending',
      provider: 'telebirr_mock',
      qrPayloadString,
    };

    this.attempts.set(attemptId, attempt);
    return attempt;
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
