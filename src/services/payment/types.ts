import { PaymentAttempt, PaymentStatus } from '../../types';

export interface CreatePaymentRequestParams {
  taxiId: string;
  tripId: string;
  seatId: string;
  seatNumber: number;
  fareAmount: number;
  currency: string;
}

export interface PaymentVerificationResult {
  attemptId: string;
  status: PaymentStatus;
  transactionRef?: string;
  confirmedAt?: string;
  errorMessage?: string;
}

export interface IPaymentService {
  createPaymentRequest(params: CreatePaymentRequestParams): Promise<PaymentAttempt>;
  checkPaymentStatus(attemptId: string): Promise<PaymentVerificationResult>;
  simulateScanAndPay(attemptId: string): Promise<PaymentVerificationResult>;
  simulateFailure(attemptId: string, reason?: string): Promise<PaymentVerificationResult>;
  simulateTimeout(attemptId: string): Promise<PaymentVerificationResult>;
}
