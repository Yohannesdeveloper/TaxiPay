export type SeatStatus = 'paid' | 'pending' | 'unpaid';

export type PaymentStatus = 
  | 'idle' 
  | 'pending' 
  | 'confirmed' 
  | 'failed' 
  | 'expired' 
  | 'offline';

export interface PaymentAttempt {
  id: string;
  taxiId: string;
  tripId: string;
  seatId: string;
  seatNumber: number;
  // When one passenger pays for several seats, the attempt covers the whole set.
  // `seatNumber` stays as the first seat so single-seat consumers keep working.
  seatNumbers: number[];
  fare: number;
  currency: string;
  timestamp: string;
  status: PaymentStatus;
  transactionRef?: string;
  provider: 'telebirr_mock' | 'Telebirr (Verified)' | string;
  qrPayloadString: string;
  errorMessage?: string;
}

export interface LivePaymentEvent {
  tripId: string;
  seatNumber: number;
  amount: number;
  transactionRef: string;
  payerPhone?: string;
  paidAt: string;
  provider: string;
}

export interface Seat {
  id: string;
  seatNumber: number;
  label?: string;
  status: SeatStatus;
  activePayment?: PaymentAttempt;
  lastPayment?: PaymentAttempt;
}

export interface Trip {
  id: string;
  taxiId: string;
  routeName: string;
  plateNumber: string;
  farePerSeat: number;
  currency: string;
  startTime: string;
  endTime?: string;
  isCompleted: boolean;
  feePerTrip?: number;
}

// Per-trip operator fee owed to the platform, collected from the driver's
// Telebirr wallet via a mandate the driver approved.
export type SettlementStatus = 'pending' | 'processing' | 'succeeded' | 'failed';

// One-time activation fee. The app stays locked until a driver's record reaches
// 'approved', which the server only writes once Telebirr has confirmed the money
// moved (or the owner approves it by hand).
export type AccessStatus = 'unpaid' | 'pending' | 'processing' | 'approved' | 'rejected';

export interface DriverAccess {
  phone: string;
  amount: number;
  currency: string;
  status: AccessStatus;
  merchantOrderId?: string;
  telebirrOrderId?: string;
  attemptCount: number;
  failureReason?: string;
  reviewedAt?: string;
  paidAt?: string;
  approvedAt?: string;
  createdAt?: string;
}

export interface AccessState {
  phone: string;
  status: AccessStatus;
  amount: number;
  payeePhone: string;
  // False when the server has no working Telebirr credentials, so the lock screen
  // can say why the payment cannot be collected instead of spinning forever.
  telebirrConfigured: boolean;
  failureReason?: string;
  attemptCount: number;
  paidAt?: string;
  approvedAt?: string;
}

export interface Settlement {
  id: number;
  tripId: string;
  amount: number;
  currency: string;
  payerPhone: string;
  payeePhone: string;
  status: SettlementStatus;
  failureReason?: string;
  merchantOrderId?: string;
  telebirrOrderId?: string;
  attemptCount: number;
  paidAt?: string;
  createdAt: string;
}

export interface Receipt {
  id: string;
  tripId: string;
  taxiId: string;
  seatNumber: number;
  plateNumber: string;
  routeName: string;
  fare: number;
  currency: string;
  transactionRef: string;
  paidAt: string;
  provider: string;
}

export type ThemeMode = 'light' | 'dark';
export type Language = 'en' | 'am';
