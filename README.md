# 🚕 TaxiPay - Ethiopian Taxi QR Payment Dashboard

**TaxiPay** is a React Native Expo application built with TypeScript, designed for Ethiopian minibus taxi drivers and conductors. It allows monitoring passenger fare payments in real-time with a clean green-and-cream dashboard, editable vehicle plate number, dynamic seat capacity management with full CRUD, and telebirr QR payment collection in safe simulation mode.

---

## 🎨 Visual Design & Aesthetics

- **Color Palette**:
  - **Background**: Warm Cream (`#FAF7F2` in light mode, `#101613` in dark mode)
  - **Headings & Accents**: Forest Green (`#133E2B` / `#1D4E37`)
  - **Primary Action Buttons**: Vibrant Lime (`#74B816` / `#84CC16`)
  - **Paid Seats**: Soft Mint Green (`#EAF8EE`, text `#145A32`) with checkmark
  - **Pending Seats**: Soft Amber (`#FEF9E7`, text `#7D6608`) with clock
  - **Unpaid Seats**: Neutral card surface (`#FFFFFF`, border `#DFD8CB`) with open circle
- **Typography & Ergonomics**:
  - Minimum **48px touch targets** for easy conductor interaction on bumpy roads.
  - Responsive seat grid (3 columns on smartphones, 4 to 6 columns on tablets).
  - Lucide icons (`lucide-react-native`) with clear visual feedback.

---

## 🌟 Key Features

### 1. Car Number / Vehicle Plate Editing
- **Direct Tap-to-Edit**: Tap the vehicle plate badge on the summary card to open the **Car Number Quick-Editor** (`EditPlateModal`).
- **Trip Settings**: Also editable inside **Trip Settings** (`TripConfigModal`).
- **Persistent Storage**: Vehicle plate changes are automatically saved to `AsyncStorage` and persist across restarts.

### 2. Full Seat / Table CRUD & Clean Slate
- **Dummy Data Removed**: Seats initialize cleanly as **Unpaid** records so you start with fresh data.
- **Seat Manager Modal (`SeatManagerModal`)**:
  - **Add**: Add new passenger seats with custom numbers and optional labels.
  - **Edit**: Rename seats (e.g. "Front Left", "Window") or change seat numbers.
  - **Update Status**: Tap the status pill to cycle between `Unpaid` ↔ `Pending` ↔ `Paid` directly (great for recording cash fares).
  - **Delete**: Select and remove any seat.
  - **Reset All (Clean)**: Instant one-tap button to reset all seats to clean unpaid status.

### 3. Trip Management & Automatic Seat Reset
- **Save Settings Reset**: Saving trip settings in `TripConfigModal` now automatically resets seats to Unpaid for the journey (with a toggle).
- **New Trip**: Starts a fresh trip, clearing previous seat payments while archiving receipts.
- **Dynamic Totals**: Collected amounts recalculate strictly from confirmed payments in real-time.

### 4. Seat Payment & QR Simulation Flow
- **Tapping an Unpaid Seat**: Opens a bottom sheet displaying:
  - Seat number, route, and fare in ETB.
  - Seat-specific payment QR code encoding stable `{ taxiId, tripId, seatId, attemptId }`.
  - State indicator: `Pending`, `Confirmed`, `Failed`, `Expired`, `Offline`.
  - Conductor simulation triggers: **"Simulate Customer Scan & Pay"**, **"Simulate Failure"**, **"Reset to Unpaid"**.
- **Tapping a Paid Seat**: Displays a digital **Payment Receipt** modal with transaction reference, timestamp, seat number, and vehicle plate.
- **Show Payment QR Button**: Bottom floating button opens an unpaid-seat selector for fast passenger billing.

### 5. Bilingual Localization
- Instant switch between **English** and **Amharic (አማርኛ)**:
  - አማርኛ: "ታክሲፔይ", "የተከፈለ", "በሂደት ላይ", "ያልተከፈለ", "የተሰበሰበው ሂሳብ", "የሰሌዳ ቁጥር", ወዘተ.

---

## 📁 Project Structure

```
Taxi/
├── App.tsx                        # Root App with Theme, Language & State Providers
├── index.ts                       # Expo root registration
├── app.json                       # Expo configuration (iOS, Android, Web)
├── package.json                   # Dependencies
├── tsconfig.json                  # TypeScript configuration
├── src/
│   ├── types/
│   │   └── index.ts               # Core interfaces (Seat, Trip, PaymentAttempt, Receipt)
│   ├── theme/
│   │   ├── colors.ts              # Forest green, warm cream, lime palette tokens
│   │   └── ThemeContext.tsx       # Light / Dark theme context & persistence
│   ├── localization/
│   │   ├── translations.ts        # English & Amharic translations
│   │   └── useTranslation.tsx     # Translation hook & language provider
│   ├── services/
│   │   └── payment/
│   │       ├── types.ts           # IPaymentService interface definition
│   │       └── mockPaymentService.ts # Idempotent payment & simulation service
│   ├── state/
│   │   ├── storage.ts             # AsyncStorage persistence helpers
│   │   └── TaxiContext.tsx        # Central trip, seats, and payment state machine
│   ├── components/
│   │   ├── Header.tsx             # Branding, language switch, theme toggle, admin link
│   │   ├── TripSummary.tsx        # Route, plate (tap to edit), collected total, progress
│   │   ├── EditPlateModal.tsx     # Dedicated quick-editor for vehicle plate number
│   │   ├── SeatCard.tsx           # Rounded seat card with custom labels and states
│   │   ├── SeatGrid.tsx           # Responsive 3-col mobile / multi-col tablet grid
│   │   ├── PaymentSheet.tsx       # Bottom sheet with QR code & simulation actions
│   │   ├── ReceiptModal.tsx       # Digital ticket receipt for confirmed payments
│   │   ├── SeatManagerModal.tsx   # Admin modal for Add, Edit, Update, Delete seats
│   │   ├── TripConfigModal.tsx    # Configure route, car number, fare, auto seat reset
│   │   └── UnpaidSeatPicker.tsx   # Fast unpaid-seat picker modal
│   ├── screens/
│   │   └── DashboardScreen.tsx    # Main conductor dashboard screen
│   └── utils/
│       └── formatters.ts          # ETB currency & plate formatters
```

---

## 🚀 Running the App

### Option A: Web Browser (Instant Preview)
Open in your browser:
```bash
http://localhost:8085
```

### Option B: Mobile Device (Android / iOS)
1. Install **Expo Go** from Google Play Store or Apple App Store.
2. Run in terminal:
   ```bash
   npx expo start
   ```
3. Scan the terminal QR code with your phone.
