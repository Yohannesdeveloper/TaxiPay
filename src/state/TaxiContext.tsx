import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { Seat, Trip, Receipt, PaymentAttempt, SeatStatus, LivePaymentEvent, Settlement } from '../types';
import { paymentService } from '../services/payment/mockPaymentService';
import { socketService } from '../services/socket/socketService';
import { useAccess } from './AccessContext';
import {
  completeTrip as completeTripRequest,
  fetchSettlements,
  retrySettlement as retrySettlementRequest,
} from '../services/settlement/settlementService';
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
  // Seats currently shown on the payment sheet. One entry for a normal fare,
  // several when one passenger is paying for a group.
  activeSheetSeats: Seat[];
  activeReceipt: Receipt | null;
  openPaymentSheet: (seat: Seat) => Promise<void>;
  openGroupPaymentSheet: (seats: Seat[]) => Promise<void>;
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

  // Per-trip operator fee (5 birr, debited from the driver via Telebirr mandate)
  feePerTrip: number;
  driverPhone: string;
  setDriverPhone: (phone: string) => void;
  settlements: Settlement[];
  currentSettlement: Settlement | null;
  isCompletingTrip: boolean;
  completeTrip: () => Promise<{ ok: boolean; message: string }>;
  refreshSettlements: () => Promise<void>;
  retrySettlement: (id: number) => Promise<{ ok: boolean; message: string }>;
}

const DEFAULT_TAXI_ID = 'ET-TAXI-0492';
const DEFAULT_PLATE = '3-B76212 AA';
const DEFAULT_ROUTE = 'Bole → Megenagna';
const DEFAULT_FARE = 40;
const DEFAULT_CAPACITY = 12;
const DEFAULT_FEE_PER_TRIP = 5;

export const TaxiContext = createContext<TaxiContextType | null>(null);

export const TaxiProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // The driver's Telebirr number lives in AccessContext: it is both the driver's
  // identity for the activation fee and the wallet the per-trip fee is debited from,
  // so it must be known before this provider can even mount.
  const { driverPhone, setDriverPhone } = useAccess();

  const [trip, setTrip] = useState<Trip>({
    id: `TRIP-${Date.now().toString().slice(-6)}`,
    taxiId: DEFAULT_TAXI_ID,
    routeName: DEFAULT_ROUTE,
    plateNumber: DEFAULT_PLATE,
    farePerSeat: DEFAULT_FARE,
    currency: 'ETB',
    startTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    isCompleted: false,
    feePerTrip: DEFAULT_FEE_PER_TRIP,
  });

  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [activeSheetSeats, setActiveSheetSeats] = useState<Seat[]>([]);
  const [activeReceipt, setActiveReceipt] = useState<Receipt | null>(null);

  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [isCompletingTrip, setIsCompletingTrip] = useState(false);

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
        seatNumbers: [event.seatNumber],
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

      // Update the open payment sheet if this seat is part of it
      setActiveSheetSeats(curr =>
        curr.map(s => (s.seatNumber === event.seatNumber ? updatedSeat : s)),
      );

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

  // Open the payment sheet for one or more seats. When a passenger pays for a
  // group, a single QR is minted for the whole seat set with the combined fare.
  const openGroupPaymentSheet = async (list: Seat[]) => {
    const payable = list.filter(s => s.status !== 'paid');
    if (payable.length === 0) return;

    // Reuse an in-flight attempt if every selected seat already shares one.
    const existing = payable.find(s => s.activePayment && s.status === 'pending');
    if (existing && payable.every(s => s.activePayment?.id === existing.activePayment?.id)) {
      setActiveSheetSeats(payable);
      return;
    }

    // Create fresh payment request for the whole seat set
    const attempt = await paymentService.createPaymentRequest({
      taxiId: trip.taxiId,
      tripId: trip.id,
      seatIds: payable.map(s => s.id),
      seatNumbers: payable.map(s => s.seatNumber),
      farePerSeat: trip.farePerSeat,
      currency: trip.currency,
    });

    const updatedSeats: Seat[] = payable.map(s => ({
      ...s,
      status: 'pending',
      activePayment: attempt,
    }));
    const byId = new Map(updatedSeats.map(s => [s.id, s]));

    setSeats(prev => {
      const next = prev.map(s => byId.get(s.id) ?? s);
      saveSeats(next);
      return next;
    });
    setActiveSheetSeats(updatedSeats);
  };

  // Open Payment Sheet for a single seat. Paid seats open their receipt instead.
  const openPaymentSheet = async (seat: Seat) => {
    if (seat.status === 'paid') {
      openReceiptModal(seat);
      return;
    }

    if (seat.activePayment && seat.status === 'pending') {
      setActiveSheetSeats([seat]);
      return;
    }

    await openGroupPaymentSheet([seat]);
  };

  const closePaymentSheet = () => {
    setActiveSheetSeats([]);
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

  // Simulate payment confirmation for the whole active seat set (one QR).
  const confirmActiveSeatPayment = async () => {
    const attempt = activeSheetSeats.find(s => s.activePayment)?.activePayment;
    if (!attempt || activeSheetSeats.length === 0) return;

    const verification = await paymentService.simulateScanAndPay(attempt.id);
    const baseRef = verification.transactionRef || `TB-VERIFIED-${Date.now().toString().slice(-4)}`;
    const paidAt = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const isGroup = activeSheetSeats.length > 1;

    const updatedSeats: Seat[] = activeSheetSeats.map(seat => {
      // A shared Telebirr payment gets a per-seat ref so each receipt stays unique.
      const ref = isGroup ? `${baseRef}-S${seat.seatNumber}` : baseRef;
      const paidAttempt: PaymentAttempt = {
        ...(seat.activePayment || attempt),
        status: 'confirmed',
        transactionRef: ref,
        timestamp: paidAt,
      };
      return { ...seat, status: 'paid', activePayment: undefined, lastPayment: paidAttempt };
    });

    const newReceipts: Receipt[] = updatedSeats.map(seat => ({
      id: `REC-${seat.id}-${seat.seatNumber}-${Date.now().toString().slice(-4)}`,
      tripId: trip.id,
      taxiId: trip.taxiId,
      seatNumber: seat.seatNumber,
      plateNumber: trip.plateNumber,
      routeName: trip.routeName,
      fare: trip.farePerSeat,
      currency: trip.currency,
      transactionRef: seat.lastPayment?.transactionRef || baseRef,
      paidAt,
      provider: 'Telebirr (Verified)',
    }));

    const byId = new Map(updatedSeats.map(s => [s.id, s]));

    setSeats(prev => {
      const next = prev.map(s => byId.get(s.id) ?? s);
      saveSeats(next);
      return next;
    });

    setReceipts(prev => {
      const updated = [...newReceipts, ...prev];
      saveReceipts(updated);
      return updated;
    });

    setActiveSheetSeats(updatedSeats);
  };

  // Simulate payment failure
  const failActiveSeatPayment = async (reason = 'Customer canceled telebirr PIN entry') => {
    const attempt = activeSheetSeats.find(s => s.activePayment)?.activePayment;
    if (!attempt || activeSheetSeats.length === 0) return;

    await paymentService.simulateFailure(attempt.id, reason);

    const updatedSeats: Seat[] = activeSheetSeats.map(seat => ({
      ...seat,
      activePayment: seat.activePayment
        ? { ...seat.activePayment, status: 'failed' as const, errorMessage: reason }
        : seat.activePayment,
    }));

    const byId = new Map(updatedSeats.map(s => [s.id, s]));
    setSeats(prev => {
      const next = prev.map(s => byId.get(s.id) ?? s);
      saveSeats(next);
      return next;
    });
    setActiveSheetSeats(updatedSeats);
  };

  // Simulate timeout
  const timeoutActiveSeatPayment = async () => {
    const attempt = activeSheetSeats.find(s => s.activePayment)?.activePayment;
    if (!attempt || activeSheetSeats.length === 0) return;

    await paymentService.simulateTimeout(attempt.id);

    const updatedSeats: Seat[] = activeSheetSeats.map(seat => ({
      ...seat,
      activePayment: seat.activePayment
        ? {
            ...seat.activePayment,
            status: 'expired' as const,
            errorMessage: 'QR session timed out. Tap to retry.',
          }
        : seat.activePayment,
    }));

    const byId = new Map(updatedSeats.map(s => [s.id, s]));
    setSeats(prev => {
      const next = prev.map(s => byId.get(s.id) ?? s);
      saveSeats(next);
      return next;
    });
    setActiveSheetSeats(updatedSeats);
  };

  // Reset the active seat set to unpaid
  const resetActiveSeatToUnpaid = () => {
    if (activeSheetSeats.length === 0) return;

    const updatedSeats: Seat[] = activeSheetSeats.map(seat => ({
      ...seat,
      status: 'unpaid',
      activePayment: undefined,
      lastPayment: undefined,
    }));

    const byId = new Map(updatedSeats.map(s => [s.id, s]));
    setSeats(prev => {
      const next = prev.map(s => byId.get(s.id) ?? s);
      saveSeats(next);
      return next;
    });
    setActiveSheetSeats(updatedSeats);
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
              seatNumbers: [s.seatNumber],
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
    setActiveSheetSeats([]);
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
    setActiveSheetSeats([]);
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
      feePerTrip: trip.feePerTrip ?? DEFAULT_FEE_PER_TRIP,
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
    setActiveSheetSeats([]);
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
      setActiveSheetSeats([]);
      setActiveReceipt(null);
    }
  };

  // -------------------------------------------------------------------------
  // Per-trip operator fee (5 birr -> 0942927999 via Telebirr mandate)
  // -------------------------------------------------------------------------

  const feePerTrip = trip.feePerTrip ?? DEFAULT_FEE_PER_TRIP;

  const mergeSettlement = useCallback((incoming: Settlement) => {
    setSettlements(prev => {
      const idx = prev.findIndex(s => s.id === incoming.id || s.tripId === incoming.tripId);
      if (idx === -1) return [incoming, ...prev];
      const next = [...prev];
      next[idx] = incoming;
      return next;
    });
  }, []);

  const refreshSettlements = useCallback(async () => {
    try {
      setSettlements(await fetchSettlements());
    } catch (e) {
      console.warn('Could not load settlements', e);
    }
  }, []);

  // Server broadcasts when a mandate debit is confirmed by Telebirr.
  useEffect(() => {
    const unsubscribe = socketService.onSettlementUpdated((settlement) => {
      if (settlement) mergeSettlement(settlement);
    });
    return unsubscribe;
  }, [mergeSettlement]);

  const completeTrip = async (): Promise<{ ok: boolean; message: string }> => {
    if (isCompletingTrip) return { ok: false, message: 'Already finishing this trip.' };

    if (!/^09\d{8}$/.test(driverPhone)) {
      return {
        ok: false,
        message: 'Enter your Telebirr number (09xxxxxxxx) so the fee can be collected.',
      };
    }

    setIsCompletingTrip(true);
    try {
      const result = await completeTripRequest({
        tripId: trip.id,
        driverPhone,
        feeAmount: feePerTrip,
      });

      if (result.settlement) mergeSettlement(result.settlement);

      if (result.alreadySettled) {
        return { ok: true, message: 'This trip fee was already collected.' };
      }

      if (result.feeWaived) {
        return { ok: true, message: 'Trip ended. No fee was charged.' };
      }

      // Mark the trip complete locally regardless. The server keeps the fee as a
      // record and retries separately, so a failed collection never loses the
      // fare the passengers already paid.
      setTrip(prev => {
        const updated: Trip = {
          ...prev,
          isCompleted: true,
          endTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        saveTrip(updated);
        return updated;
      });

      if (result.awaitingConfirmation) {
        return { ok: true, message: `Trip ended. ${feePerTrip} birr fee sent to Telebirr.` };
      }

      return {
        ok: true,
        message: `Trip ended. ${feePerTrip} birr fee recorded but not collected yet.`,
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Could not reach the payment server.';
      return { ok: false, message };
    } finally {
      setIsCompletingTrip(false);
    }
  };

  const retrySettlement = async (id: number): Promise<{ ok: boolean; message: string }> => {
    try {
      const result = await retrySettlementRequest(id);
      if (result.settlement) mergeSettlement(result.settlement);

      if (result.alreadySettled) return { ok: true, message: 'Already collected.' };
      if (result.awaitingConfirmation) return { ok: true, message: 'Fee sent to Telebirr.' };
      return { ok: false, message: result.reason || 'Fee still not collected.' };
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Retry failed.';
      return { ok: false, message };
    }
  };

  const currentSettlement = useMemo(
    () => settlements.find(s => s.tripId === trip.id) || null,
    [settlements, trip.id],
  );

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
        activeSheetSeats,
        activeReceipt,
        openPaymentSheet,
        openGroupPaymentSheet,
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
        feePerTrip,
        driverPhone,
        setDriverPhone,
        settlements,
        currentSettlement,
        isCompletingTrip,
        completeTrip,
        refreshSettlements,
        retrySettlement,
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
