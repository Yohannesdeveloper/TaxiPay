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
