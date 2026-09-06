import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { Seat, Trip, Receipt, PaymentAttempt, SeatStatus, LivePaymentEvent } from '../types';
import { paymentService } from '../services/payment/mockPaymentService';
import { socketService } from '../services/socket/socketService';
import {
  saveCapacity,
  loadCapacity,
  saveReceipts,
  loadReceipts,
  saveSeats,
  loadSeats,
  saveTrip,
  loadTrip,
  savePlateNumber,
  loadPlateNumber,
} from './storage';

interface TaxiContextType {
  trip: Trip;
  seats: Seat[];
  receipts: Receipt[];
  collectedTotal: number;
  paidCount: number;
  pendingCount: number;
  unpaidCount: number;
  unresolvedCount: number;
  activeSheetSeat: Seat | null;
  activeReceipt: Receipt | null;
  openPaymentSheet: (seat: Seat) => Promise<void>;
  closePaymentSheet: () => void;
  openReceiptModal: (seat: Seat) => void;
  closeReceiptModal: () => void;
  
  // Payment actions
  confirmActiveSeatPayment: () => Promise<void>;
  failActiveSeatPayment: (reason?: string) => Promise<void>;
  timeoutActiveSeatPayment: () => Promise<void>;
  resetActiveSeatToUnpaid: () => void;

  // Car / Plate management
  updatePlateNumber: (plate: string) => void;

  // Seat / Table CRUD
  addSeat: (seatNumber?: number, label?: string) => boolean;
  editSeat: (seatId: string, updates: { seatNumber?: number; label?: string; status?: SeatStatus }) => void;
  updateSeatStatus: (seatNumber: number, newStatus: SeatStatus) => void;
  removeSeat: (seatNumber: number, force?: boolean) => { success: boolean; message?: string };
  canRemoveSeat: (seatNumber: number) => { canRemove: boolean; reason?: string };
  resetSeatsToUnpaid: () => void;
  clearDummyData: (defaultCapacity?: number) => void;

  // Trip actions
  startNewTrip: (newRoute?: string, newFare?: number, newPlate?: string) => void;
  updateTripDetails: (route: string, fare: number, plate: string, resetSeatsOnSave?: boolean) => void;
}

const DEFAULT_TAXI_ID = 'ET-TAXI-0492';
const DEFAULT_PLATE = '3-B76212 AA';
const DEFAULT_ROUTE = 'Bole → Megenagna';
const DEFAULT_FARE = 40;
const DEFAULT_CAPACITY = 12;

export const TaxiContext = createContext<TaxiContextType | null>(null);

export const TaxiProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [trip, setTrip] = useState<Trip>({
    id: `TRIP-${Date.now().toString().slice(-6)}`,
    taxiId: DEFAULT_TAXI_ID,
    routeName: DEFAULT_ROUTE,
    plateNumber: DEFAULT_PLATE,
    farePerSeat: DEFAULT_FARE,
    currency: 'ETB',
    startTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    isCompleted: false,
  });

  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [activeSheetSeat, setActiveSheetSeat] = useState<Seat | null>(null);
  const [activeReceipt, setActiveReceipt] = useState<Receipt | null>(null);

  // Clean initial seats: all 12 seats start clean as UNPAID (no hardcoded paid dummy data)
  const [seats, setSeats] = useState<Seat[]>(() => {
    const list: Seat[] = [];
    for (let i = 1; i <= DEFAULT_CAPACITY; i++) {
      list.push({
        id: `SEAT-${i}`,
        seatNumber: i,
        status: 'unpaid',
      });
    }
    return list;
  });

  // Load saved state on mount (persisted seats, plate, trip, receipts)
  useEffect(() => {
    (async () => {
      try {
        const storedPlate = await loadPlateNumber();
        const storedTrip = await loadTrip();
        const storedSeats = await loadSeats();
        const storedReceipts = await loadReceipts();

        if (storedTrip) {
          setTrip(prev => ({
            ...prev,
            ...storedTrip,
            plateNumber: storedPlate || storedTrip.plateNumber || prev.plateNumber,
          }));
        } else if (storedPlate) {
          setTrip(prev => ({ ...prev, plateNumber: storedPlate }));
        }

        if (storedSeats && storedSeats.length > 0) {
          setSeats(storedSeats);
        }

        if (storedReceipts) {
          setReceipts(storedReceipts);
        }
      } catch (e) {
        console.warn('Error loading stored taxi state', e);
      }
    })();
  }, []);

  // Handle Real-time incoming payment from PostgreSQL / Telebirr socket
  const handleIncomingLivePayment = useCallback((event: LivePaymentEvent) => {
    console.log('⚡ [TaxiContext] Processing live payment for seat #', event.seatNumber);

    setSeats(prev => {
      const targetSeat = prev.find(s => s.seatNumber === event.seatNumber);
      if (!targetSeat) return prev;

      // If already marked as paid, don't duplicate
      if (targetSeat.status === 'paid') return prev;

      const paidAttempt: PaymentAttempt = {
        id: `TX-${event.transactionRef}`,
        taxiId: trip.taxiId,
        tripId: trip.id,
        seatId: targetSeat.id,
        seatNumber: event.seatNumber,
        fare: event.amount || trip.farePerSeat,
        currency: trip.currency,
        timestamp: event.paidAt || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'confirmed',
        provider: 'Telebirr (Verified)',
        transactionRef: event.transactionRef,
        qrPayloadString: '',
      };

      const updatedSeat: Seat = {
        ...targetSeat,
        status: 'paid',
        activePayment: undefined,
        lastPayment: paidAttempt,
      };

      const newReceipt: Receipt = {
        id: `REC-${updatedSeat.id}-${Date.now().toString().slice(-4)}`,
        tripId: trip.id,
        taxiId: trip.taxiId,
        seatNumber: updatedSeat.seatNumber,
        plateNumber: trip.plateNumber,
        routeName: trip.routeName,
        fare: event.amount || trip.farePerSeat,
        currency: trip.currency,
        transactionRef: event.transactionRef,
        paidAt: paidAttempt.timestamp,
        provider: 'Telebirr (Verified)',
      };

      setReceipts(prevRecs => {
        if (prevRecs.some(r => r.transactionRef === event.transactionRef)) {
          return prevRecs;
        }
        const updatedRecs = [newReceipt, ...prevRecs];
        saveReceipts(updatedRecs);
        return updatedRecs;
      });

      // Update activeSheetSeat if currently open
      setActiveSheetSeat(curr => {
        if (curr && curr.seatNumber === event.seatNumber) {
          return updatedSeat;
        }
        return curr;
      });

      const nextSeats = prev.map(s => (s.id === targetSeat.id ? updatedSeat : s));
      saveSeats(nextSeats);
      return nextSeats;
    });
  }, [trip]);

  // Connect to realtime socket server & sync trip with PostgreSQL backend
  useEffect(() => {
    socketService.connect();
    socketService.joinTrip(trip.id);
    socketService.syncTripWithServer(trip, seats);

    const unsubscribe = socketService.onPaymentReceived((event) => {
      handleIncomingLivePayment(event);
    });

    return () => {
      unsubscribe();
    };
  }, [trip.id, handleIncomingLivePayment]);

  // Compute summary stats dynamically - calculated strictly from confirmed payments
  const { collectedTotal, paidCount, pendingCount, unpaidCount } = useMemo(() => {
    let collected = 0;
    let paid = 0;
    let pending = 0;
    let unpaid = 0;

    seats.forEach(s => {
      if (s.status === 'paid') {
        paid++;
        collected += trip.farePerSeat;
      } else if (s.status === 'pending') {
        pending++;
      } else {
        unpaid++;
      }
    });

    return {
      collectedTotal: collected,
      paidCount: paid,
      pendingCount: pending,
      unpaidCount: unpaid,
    };
  }, [seats, trip.farePerSeat]);

  const unresolvedCount = pendingCount + unpaidCount;

  // Open Payment Sheet for a seat
  const openPaymentSheet = async (seat: Seat) => {
    if (seat.status === 'paid') {
      openReceiptModal(seat);
      return;
    }

    if (seat.activePayment && seat.status === 'pending') {
      setActiveSheetSeat(seat);
      return;
    }

    // Create fresh payment request
    const attempt = await paymentService.createPaymentRequest({
      taxiId: trip.taxiId,
      tripId: trip.id,
      seatId: seat.id,
      seatNumber: seat.seatNumber,
      fareAmount: trip.farePerSeat,
      currency: trip.currency,
    });

    const updatedSeat: Seat = {
      ...seat,
      status: 'pending',
      activePayment: attempt,
    };

    setSeats(prev => {
      const next = prev.map(s => (s.id === seat.id ? updatedSeat : s));
      saveSeats(next);
      return next;
    });
    setActiveSheetSeat(updatedSeat);
  };

  const closePaymentSheet = () => {
    setActiveSheetSeat(null);
  };

  const openReceiptModal = (seat: Seat) => {
    const existing = receipts.find(r => r.seatNumber === seat.seatNumber && r.tripId === trip.id);
    if (existing) {
      setActiveReceipt(existing);
    } else {
      const newRec: Receipt = {
        id: `REC-${seat.id}-${Date.now().toString().slice(-4)}`,
        tripId: trip.id,
        taxiId: trip.taxiId,
        seatNumber: seat.seatNumber,
        plateNumber: trip.plateNumber,
        routeName: trip.routeName,
        fare: trip.farePerSeat,
        currency: trip.currency,
        transactionRef: seat.lastPayment?.transactionRef || `TB-CONFIRMED-${seat.seatNumber}`,
        paidAt: seat.lastPayment?.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        provider: 'Telebirr (Verified)',
      };
      setActiveReceipt(newRec);
    }
  };

  const closeReceiptModal = () => {
    setActiveReceipt(null);
  };

  // Simulate payment confirmation
  const confirmActiveSeatPayment = async () => {
    if (!activeSheetSeat || !activeSheetSeat.activePayment) return;

    const verification = await paymentService.simulateScanAndPay(activeSheetSeat.activePayment.id);
    
    const paidAttempt: PaymentAttempt = {
      ...activeSheetSeat.activePayment,
      status: 'confirmed',
      transactionRef: verification.transactionRef,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const updatedSeat: Seat = {
      ...activeSheetSeat,
      status: 'paid',
      activePayment: undefined,
      lastPayment: paidAttempt,
    };

    const newReceipt: Receipt = {
      id: `REC-${updatedSeat.id}-${Date.now().toString().slice(-4)}`,
      tripId: trip.id,
      taxiId: trip.taxiId,
      seatNumber: updatedSeat.seatNumber,
      plateNumber: trip.plateNumber,
      routeName: trip.routeName,
      fare: trip.farePerSeat,
      currency: trip.currency,
      transactionRef: verification.transactionRef || `TB-VERIFIED-${Date.now().toString().slice(-4)}`,
      paidAt: paidAttempt.timestamp,
      provider: 'Telebirr (Verified)',
    };

    setSeats(prev => {
      const next = prev.map(s => (s.id === updatedSeat.id ? updatedSeat : s));
      saveSeats(next);
      return next;
    });

    setReceipts(prev => {
      const updated = [newReceipt, ...prev];
      saveReceipts(updated);
      return updated;
    });

    setActiveSheetSeat(updatedSeat);
  };

  // Simulate payment failure
  const failActiveSeatPayment = async (reason = 'Customer canceled telebirr PIN entry') => {
    if (!activeSheetSeat || !activeSheetSeat.activePayment) return;

    await paymentService.simulateFailure(activeSheetSeat.activePayment.id, reason);

    const failedAttempt: PaymentAttempt = {
      ...activeSheetSeat.activePayment,
      status: 'failed',
      errorMessage: reason,
    };

    const updatedSeat: Seat = {
      ...activeSheetSeat,
      activePayment: failedAttempt,
    };

    setSeats(prev => {
      const next = prev.map(s => (s.id === updatedSeat.id ? updatedSeat : s));
      saveSeats(next);
      return next;
    });
    setActiveSheetSeat(updatedSeat);
  };

  // Simulate timeout
  const timeoutActiveSeatPayment = async () => {
    if (!activeSheetSeat || !activeSheetSeat.activePayment) return;

    await paymentService.simulateTimeout(activeSheetSeat.activePayment.id);

    const expiredAttempt: PaymentAttempt = {
      ...activeSheetSeat.activePayment,
      status: 'expired',
      errorMessage: 'QR session timed out. Tap to retry.',
    };

    const updatedSeat: Seat = {
      ...activeSheetSeat,
      activePayment: expiredAttempt,
    };

    setSeats(prev => {
      const next = prev.map(s => (s.id === updatedSeat.id ? updatedSeat : s));
      saveSeats(next);
      return next;
    });
    setActiveSheetSeat(updatedSeat);
  };

  // Reset active seat to unpaid
  const resetActiveSeatToUnpaid = () => {
    if (!activeSheetSeat) return;

    const updatedSeat: Seat = {
      ...activeSheetSeat,
      status: 'unpaid',
      activePayment: undefined,
      lastPayment: undefined,
    };

    setSeats(prev => {
      const next = prev.map(s => (s.id === updatedSeat.id ? updatedSeat : s));
      saveSeats(next);
      return next;
    });
    setActiveSheetSeat(updatedSeat);
  };

  // Update plate / car number
  const updatePlateNumber = (newPlate: string) => {
    const formatted = newPlate.trim().toUpperCase();
    setTrip(prev => {
      const updated = { ...prev, plateNumber: formatted };
      saveTrip(updated);
      return updated;
    });
    savePlateNumber(formatted);
  };

  // Seat / Table CRUD: Add seat
  const addSeat = (customNumber?: number, label?: string): boolean => {
    if (seats.length >= 30) return false;
    const nextNumber = customNumber || (seats.length > 0 ? Math.max(...seats.map(s => s.seatNumber)) + 1 : 1);
    const newSeat: Seat = {
      id: `SEAT-${Date.now()}-${nextNumber}`,
      seatNumber: nextNumber,
      label: label || `Seat ${nextNumber}`,
      status: 'unpaid',
    };
    const updated = [...seats, newSeat];
    setSeats(updated);
    saveSeats(updated);
    saveCapacity(updated.length);
    return true;
  };

  // Seat / Table CRUD: Edit seat
  const editSeat = (seatId: string, updates: { seatNumber?: number; label?: string; status?: SeatStatus }) => {
    setSeats(prev => {
      const next = prev.map(s => {
        if (s.id === seatId) {
          return {
            ...s,
            seatNumber: updates.seatNumber !== undefined ? updates.seatNumber : s.seatNumber,
            label: updates.label !== undefined ? updates.label : s.label,
            status: updates.status !== undefined ? updates.status : s.status,
          };
        }
        return s;
      });
      saveSeats(next);
      return next;
    });
  };

  // Seat / Table CRUD: Update status directly (e.g., cash payment or reset)
  const updateSeatStatus = (seatNumber: number, newStatus: SeatStatus) => {
    setSeats(prev => {
      const next: Seat[] = prev.map(s => {
        if (s.seatNumber === seatNumber) {
          if (newStatus === 'paid') {
            const manualAttempt: PaymentAttempt = {
              id: `MANUAL-${s.id}-${Date.now().toString().slice(-4)}`,
              taxiId: trip.taxiId,
              tripId: trip.id,
              seatId: s.id,
              seatNumber: s.seatNumber,
              fare: trip.farePerSeat,
              currency: trip.currency,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              status: 'confirmed',
              provider: 'telebirr_mock',
              transactionRef: `MANUAL-${Math.floor(100000 + Math.random() * 900000)}`,
              qrPayloadString: '',
            };
            return {
              ...s,
              status: 'paid' as SeatStatus,
              activePayment: undefined,
              lastPayment: manualAttempt,
            };
          } else if (newStatus === 'unpaid') {
            return {
              ...s,
              status: 'unpaid' as SeatStatus,
              activePayment: undefined,
              lastPayment: undefined,
            };
          } else {
            return {
              ...s,
              status: 'pending' as SeatStatus,
            };
          }
        }
        return s;
      });
      saveSeats(next);
      return next;
    });
  };

  const canRemoveSeat = (seatNumber: number): { canRemove: boolean; reason?: string } => {
    if (seats.length <= 1) {
      return { canRemove: false, reason: 'minCapacity' };
    }
    const target = seats.find(s => s.seatNumber === seatNumber);
    if (!target) {
      return { canRemove: false, reason: 'notFound' };
    }
    if (target.status === 'paid' || target.status === 'pending') {
      return { canRemove: false, reason: 'activePayment' };
    }
    return { canRemove: true };
  };

  // Remove seat
  const removeSeat = (seatNumber: number, force: boolean = false): { success: boolean; message?: string } => {
    if (!force) {
      const check = canRemoveSeat(seatNumber);
      if (!check.canRemove) {
        return { success: false, message: check.reason };
      }
    }

    const updated = seats.filter(s => s.seatNumber !== seatNumber);
    setSeats(updated);
    saveSeats(updated);
    saveCapacity(updated.length);
    return { success: true };
  };

  // Reset all seats to unpaid
  const resetSeatsToUnpaid = () => {
    setSeats(prev => {
      const reset = prev.map(s => ({
        id: s.id,
        seatNumber: s.seatNumber,
        label: s.label,
        status: 'unpaid' as SeatStatus,
        activePayment: undefined,
        lastPayment: undefined,
      }));
      saveSeats(reset);
      return reset;
    });
    setActiveSheetSeat(null);
    setActiveReceipt(null);
  };

  // Clear dummy data and start fresh with N seats (all unpaid)
  const clearDummyData = (defaultCapacity: number = 12) => {
    const cleanList: Seat[] = [];
    for (let i = 1; i <= defaultCapacity; i++) {
      cleanList.push({
        id: `SEAT-${i}`,
        seatNumber: i,
        status: 'unpaid',
      });
    }
    setSeats(cleanList);
    saveSeats(cleanList);
    saveCapacity(cleanList.length);
    setActiveSheetSeat(null);
    setActiveReceipt(null);
  };

  // Start New Trip - creates fresh trip record & resets all seats to Unpaid
  const startNewTrip = (newRoute?: string, newFare?: number, newPlate?: string) => {
    const newTripId = `TRIP-${Date.now().toString().slice(-6)}`;
    const finalPlate = (newPlate || trip.plateNumber).trim().toUpperCase();
    const newTripObj: Trip = {
      id: newTripId,
      taxiId: trip.taxiId,
      routeName: (newRoute || trip.routeName).trim(),
      plateNumber: finalPlate,
      farePerSeat: newFare ?? trip.farePerSeat,
      currency: 'ETB',
      startTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isCompleted: false,
    };

    // Reset all seats to fresh unpaid status
    const resetSeats: Seat[] = seats.map(s => ({
      id: s.id,
      seatNumber: s.seatNumber,
      label: s.label,
      status: 'unpaid' as SeatStatus,
      activePayment: undefined,
      lastPayment: undefined,
    }));

    setTrip(newTripObj);
    setSeats(resetSeats);
    saveTrip(newTripObj);
    saveSeats(resetSeats);
    savePlateNumber(finalPlate);
    setActiveSheetSeat(null);
    setActiveReceipt(null);
  };

  // Update Trip Details - When saving settings, user requested seats to be reset as well
  const updateTripDetails = (route: string, fare: number, plate: string, resetSeatsOnSave: boolean = true) => {
    const formattedPlate = plate.trim().toUpperCase();
    const updatedTrip: Trip = {
      ...trip,
      routeName: route.trim(),
      farePerSeat: fare,
      plateNumber: formattedPlate,
    };

    setTrip(updatedTrip);
    saveTrip(updatedTrip);
    savePlateNumber(formattedPlate);

    if (resetSeatsOnSave) {
      const resetSeats: Seat[] = seats.map(s => ({
        id: s.id,
        seatNumber: s.seatNumber,
        label: s.label,
        status: 'unpaid' as SeatStatus,
        activePayment: undefined,
        lastPayment: undefined,
      }));
      setSeats(resetSeats);
      saveSeats(resetSeats);
      setActiveSheetSeat(null);
      setActiveReceipt(null);
    }
  };

  return (
    <TaxiContext.Provider
      value={{
        trip,
        seats,
        receipts,
        collectedTotal,
        paidCount,
        pendingCount,
        unpaidCount,
        unresolvedCount,
        activeSheetSeat,
        activeReceipt,
        openPaymentSheet,
        closePaymentSheet,
        openReceiptModal,
        closeReceiptModal,
        confirmActiveSeatPayment,
        failActiveSeatPayment,
        timeoutActiveSeatPayment,
        resetActiveSeatToUnpaid,
        updatePlateNumber,
        addSeat,
        editSeat,
        updateSeatStatus,
        removeSeat,
        canRemoveSeat,
        resetSeatsToUnpaid,
        clearDummyData,
        startNewTrip,
        updateTripDetails,
      }}
    >
      {children}
    </TaxiContext.Provider>
  );
};

export const useTaxi = () => {
  const context = useContext(TaxiContext);
  if (!context) {
    throw new Error('useTaxi must be used within a TaxiProvider');
  }
  return context;
};
