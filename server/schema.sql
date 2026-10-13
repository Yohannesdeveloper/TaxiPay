-- TaxiPay PostgreSQL Database Schema for Railway

-- Trips Table
CREATE TABLE IF NOT EXISTS trips (
    id VARCHAR(50) PRIMARY KEY,
    taxi_id VARCHAR(50) NOT NULL,
    plate_number VARCHAR(20) NOT NULL,
    route_name VARCHAR(100) NOT NULL,
    fare_per_seat NUMERIC(10, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'ETB',
    fee_per_trip NUMERIC(10, 2) DEFAULT 5.00,
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'completed'
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seats Table
CREATE TABLE IF NOT EXISTS seats (
    id SERIAL PRIMARY KEY,
    trip_id VARCHAR(50) REFERENCES trips(id) ON DELETE CASCADE,
    seat_number INT NOT NULL,
    status VARCHAR(20) DEFAULT 'unpaid', -- 'unpaid', 'pending', 'paid'
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(trip_id, seat_number)
);

-- Payments Table (Audit Ledger for Telebirr Transactions)
CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    trip_id VARCHAR(50) REFERENCES trips(id),
    seat_number INT NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'ETB',
    transaction_ref VARCHAR(100) UNIQUE NOT NULL,
    provider VARCHAR(50) DEFAULT 'Telebirr (Verified)',
    status VARCHAR(20) DEFAULT 'confirmed',
    payer_phone VARCHAR(30),
    paid_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Settlements Table (per-trip operator fee, debited from the driver via Telebirr mandate)
-- UNIQUE(trip_id) is the idempotency guarantee: a retried trip-complete request
-- can never create a second 5 birr charge for the same trip.
CREATE TABLE IF NOT EXISTS settlements (
    id SERIAL PRIMARY KEY,
    trip_id VARCHAR(50) NOT NULL UNIQUE REFERENCES trips(id) ON DELETE CASCADE,
    amount NUMERIC(10, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'ETB',
    payer_phone VARCHAR(30) NOT NULL,
    payee_phone VARCHAR(30) NOT NULL,
    status VARCHAR(30) DEFAULT 'pending', -- 'pending', 'processing', 'succeeded', 'failed'
    failure_reason TEXT,
    merchant_order_id VARCHAR(100),
    telebirr_order_id VARCHAR(100),
    attempt_count INT NOT NULL DEFAULT 0,
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Driver Access Table (one-time activation fee that unlocks the app)
--
-- The driver app refuses to open until this row reaches 'approved'. That status is
-- only ever written after Telebirr confirms the money actually moved: a
-- signature-verified notify_url callback, or a verified queryOrder whose amount
-- matches. A client claiming "I paid" can never flip it, because the client is not
-- the writer. The owner can additionally approve or revoke a row by hand from the
-- in-app admin screen.
--
-- UNIQUE(merchant_order_id) keeps the Telebirr callback unambiguous: exactly one
-- driver row can ever be the target of a given Telebirr order.
CREATE TABLE IF NOT EXISTS driver_access (
    phone VARCHAR(30) PRIMARY KEY,
    amount NUMERIC(10, 2) NOT NULL DEFAULT 5.00,
    currency VARCHAR(10) DEFAULT 'ETB',
    status VARCHAR(20) NOT NULL DEFAULT 'unpaid', -- 'unpaid', 'pending', 'processing', 'approved', 'rejected'
    merchant_order_id VARCHAR(100) UNIQUE,
    telebirr_order_id VARCHAR(100),
    attempt_count INT NOT NULL DEFAULT 0,
    failure_reason TEXT,
    reviewed_by VARCHAR(60),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    paid_at TIMESTAMP WITH TIME ZONE,
    approved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_seats_trip ON seats(trip_id);
CREATE INDEX IF NOT EXISTS idx_payments_trip ON payments(trip_id);
CREATE INDEX IF NOT EXISTS idx_settlements_status ON settlements(status);
CREATE INDEX IF NOT EXISTS idx_driver_access_status ON driver_access(status);

-- Migrations for databases created before these columns existed.
-- CREATE TABLE IF NOT EXISTS will not add columns to an existing table.
ALTER TABLE trips ADD COLUMN IF NOT EXISTS fee_per_trip NUMERIC(10, 2) DEFAULT 5.00;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';
ALTER TABLE trips ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;
