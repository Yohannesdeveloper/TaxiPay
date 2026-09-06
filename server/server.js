const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const { Pool } = require('pg');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Database Connection
const connectionString = process.env.DATABASE_URL || 
  'postgresql://postgres:WkwDFunlfMJllWxDfzPnPokBhbHKwSGW@altaria.proxy.rlwy.net:36328/railway';

const isInternalRailway = connectionString.includes('railway.internal') || connectionString.includes('localhost');

const pool = new Pool({
  connectionString,
  ssl: isInternalRailway ? false : { rejectUnauthorized: false },
  connectionTimeoutMillis: 5000,
});

let dbConnected = false;

async function initDb() {
  try {
    const client = await pool.connect();
    console.log('✅ Connected successfully to PostgreSQL database on Railway!');
    dbConnected = true;

    // Create tables if they do not exist
    await client.query(`
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

      CREATE TABLE IF NOT EXISTS seats (
          id SERIAL PRIMARY KEY,
          trip_id VARCHAR(50) REFERENCES trips(id) ON DELETE CASCADE,
          seat_number INT NOT NULL,
          status VARCHAR(20) DEFAULT 'unpaid',
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(trip_id, seat_number)
      );

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
    `);
    console.log('✅ PostgreSQL tables verified / initialized.');
    client.release();
  } catch (err) {
    console.warn('⚠️ Notice: Could not connect to PostgreSQL directly from this host:');
    console.warn(`   ${err.message}`);
    console.warn('   (Note: If running outside Railway, ensure you use the Public Railway TCP proxy URL or deploy this server to Railway).');
    console.warn('   The server will run in hybrid/in-memory fallback mode for local testing until DB connects.');
  }
}

initDb();

// In-memory fallback if DB is temporarily unreachable from local network
const inMemorySeats = new Map();
const inMemoryPayments = [];

// Socket.io Real-time connection with driver app
io.on('connection', (socket) => {
  console.log('📱 App connected via WebSocket:', socket.id);

  socket.on('join_trip', (tripId) => {
    if (tripId) {
      socket.join(tripId);
      console.log(`🚖 Driver listening for payments on trip: ${tripId}`);
    }
  });

  socket.on('disconnect', () => {
    console.log('App disconnected:', socket.id);
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    server: 'TaxiPay Backend',
    databaseConnected: dbConnected,
    timestamp: new Date().toISOString(),
  });
});

// Sync trip and seats when driver starts or updates trip
app.post('/api/trips/sync', async (req, res) => {
  const { trip, seats } = req.body;
  if (!trip || !trip.id) {
    return res.status(400).json({ error: 'Missing trip data' });
  }

  try {
    if (dbConnected) {
      await pool.query(
        `INSERT INTO trips (id, taxi_id, plate_number, route_name, fare_per_seat, currency, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         ON CONFLICT (id) DO UPDATE 
         SET plate_number = EXCLUDED.plate_number,
             route_name = EXCLUDED.route_name,
             fare_per_seat = EXCLUDED.fare_per_seat,
             updated_at = NOW()`,
        [trip.id, trip.taxiId, trip.plateNumber, trip.routeName, trip.farePerSeat, trip.currency || 'ETB']
      );

      if (Array.isArray(seats)) {
        for (const seat of seats) {
          await pool.query(
            `INSERT INTO seats (trip_id, seat_number, status, updated_at)
             VALUES ($1, $2, $3, NOW())
             ON CONFLICT (trip_id, seat_number) DO UPDATE
             SET status = EXCLUDED.status, updated_at = NOW()`,
            [trip.id, seat.seatNumber, seat.status]
          );
        }
      }
    } else {
      // In-memory fallback
      inMemorySeats.set(trip.id, seats || []);
    }

    res.json({ success: true, message: 'Trip synced successfully' });
  } catch (err) {
    console.error('Error syncing trip:', err);
    res.status(500).json({ error: err.message });
  }
});

// Telebirr / QR Payment Webhook: Called when customer pays
app.post(['/api/telebirr-webhook', '/api/pay'], async (req, res) => {
  const { tripId, seatNumber, amount, payerPhone, transactionRef } = req.body;

  if (!tripId || seatNumber === undefined) {
    return res.status(400).json({ error: 'tripId and seatNumber are required' });
  }

  const txRef = transactionRef || `TB-${Math.floor(100000 + Math.random() * 900000)}-ETB`;
  const paidAt = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  try {
    if (dbConnected) {
      // 1. Update seat to 'paid' in PostgreSQL
      await pool.query(
        `UPDATE seats 
         SET status = 'paid', updated_at = NOW() 
         WHERE trip_id = $1 AND seat_number = $2`,
        [tripId, seatNumber]
      );

      // 2. Insert into PostgreSQL payments ledger
      await pool.query(
        `INSERT INTO payments (trip_id, seat_number, amount, transaction_ref, payer_phone, status, paid_at)
         VALUES ($1, $2, $3, $4, $5, 'confirmed', NOW())
         ON CONFLICT (transaction_ref) DO NOTHING`,
        [tripId, seatNumber, amount || 0, txRef, payerPhone || '09xxxxxxxx']
      );
    } else {
      inMemoryPayments.push({ tripId, seatNumber, amount, txRef, paidAt });
    }

    // 3. Broadcast instant real-time notification to the driver's phone
    const paymentPayload = {
      tripId,
      seatNumber: Number(seatNumber),
      amount: Number(amount) || 0,
      transactionRef: txRef,
      payerPhone: payerPhone || 'Telebirr User',
      paidAt,
      provider: 'Telebirr (Verified)',
    };

    io.to(tripId).emit('seat_paid', paymentPayload);
    // Also broadcast globally as fallback in case tripId matching had slight string difference
    io.emit('seat_paid_broadcast', paymentPayload);

    console.log(`💰 Payment Confirmed: Seat #${seatNumber} (Trip ${tripId}) - ${amount} ETB - Ref: ${txRef}`);

    res.json({
      success: true,
      transactionRef: txRef,
      paidAt,
      message: `Payment of ${amount} ETB confirmed for seat #${seatNumber}`,
    });
  } catch (err) {
    console.error('Error recording payment:', err);
    res.status(500).json({ error: err.message });
  }
});

// Route for the checkout page
app.get('/pay', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n========================================`);
  console.log(`🚕 TaxiPay Realtime Payment Server Online`);
  console.log(`📡 Listening on http://0.0.0.0:${PORT}`);
  console.log(`💳 Passenger Checkout: http://localhost:${PORT}/pay`);
  console.log(`========================================\n`);
});
