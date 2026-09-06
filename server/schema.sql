-- TaxiPay PostgreSQL Database Schema for Railway

-- Trips Table
CREATE TABLE IF NOT EXISTS trips (
    id VARCHAR(50) PRIMARY KEY,
    taxi_id VARCHAR(50) NOT NULL,
    plate_number VARCHAR(20) NOT NULL,
    route_name VARCHAR(100) NOT NULL,
    fare_per_seat NUMERIC(10, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'ETB',
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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_seats_trip ON seats(trip_id);
CREATE INDEX IF NOT EXISTS idx_payments_trip ON payments(trip_id);
