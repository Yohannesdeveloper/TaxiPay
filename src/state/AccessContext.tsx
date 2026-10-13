import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { AccessState, DriverAccess } from '../types';
import { socketService } from '../services/socket/socketService';
import {
  fetchAccessStatus,
  payAccessFee as payAccessFeeRequest,
  verifyAccessPayment as verifyAccessPaymentRequest,
} from '../services/access/accessService';
import { loadDriverPhone, saveDriverPhone } from './storage';

// While the lock screen is up the driver has usually just tapped "pay" in the
// Telebirr app, so poll as a safety net. The notify callback is the primary signal;
// this only covers a callback that never arrives.
const ACCESS_POLL_INTERVAL_MS = 15000;

const isValidPhone = (phone: string) => /^09\d{8}$/.test(phone);

interface AccessContextType {
  // The driver's Telebirr number. It is the driver's identity here, and the wallet
  // the per-trip fee is later debited from.
  driverPhone: string;
  setDriverPhone: (phone: string) => void;

  // null until we know a number to ask the server about.
  access: AccessState | null;
  hasAccess: boolean;

  isLoading: boolean;
  isPaying: boolean;
  isVerifying: boolean;

  refreshAccess: () => Promise<void>;
  payAccessFee: () => Promise<{ ok: boolean; message: string }>;
  verifyAccessPayment: () => Promise<{ ok: boolean; message: string }>;
  // Applied straight from the socket, so the lock screen unlocks the moment the
  // server approves rather than on the next poll.
  applyAccessUpdate: (incoming: DriverAccess) => void;
}

const AccessContext = createContext<AccessContextType | null>(null);

export const AccessProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [driverPhone, setDriverPhoneState] = useState('');
  const [access, setAccess] = useState<AccessState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPaying, setIsPaying] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const mergeAccess = useCallback((incoming: AccessState) => {
    setAccess((current) => (current ? { ...current, ...incoming } : incoming));
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const stored = await loadDriverPhone();
        if (stored) setDriverPhoneState(stored);
      } catch (e) {
        console.warn('Error loading driver phone for access check', e);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const setDriverPhone = useCallback((phone: string) => {
    const cleaned = phone.replace(/\s+/g, '');
    setDriverPhoneState(cleaned);
    saveDriverPhone(cleaned);

    // A new number means the previous answer no longer describes this driver, so
    // drop it rather than showing another driver's approval.
    setAccess((current) => (current && current.phone !== cleaned ? null : current));
  }, []);

  const applyAccessUpdate = useCallback(
    (incoming: DriverAccess) => {
      setAccess((current) => {
        if (!current || current.phone !== incoming.phone) return current;
        return {
          ...current,
          status: incoming.status,
          amount: incoming.amount,
          failureReason: incoming.failureReason,
          attemptCount: incoming.attemptCount,
          paidAt: incoming.paidAt,
          approvedAt: incoming.approvedAt,
        };
      });
    },
    [],
  );

  const refreshAccess = useCallback(async () => {
    if (!isValidPhone(driverPhone)) {
      setAccess(null);
      return;
    }

    try {
      mergeAccess(await fetchAccessStatus(driverPhone));
    } catch (e) {
      // Keep whatever we already knew. A network blip must not turn an approved
      // driver back into a locked screen with no explanation.
      console.warn('Could not read access status', e);
    }
  }, [driverPhone, mergeAccess]);

  const payAccessFee = useCallback(async (): Promise<{ ok: boolean; message: string }> => {
    if (!isValidPhone(driverPhone)) {
      return { ok: false, message: 'Enter your Telebirr number (09xxxxxxxx) first.' };
    }

    setIsPaying(true);
    try {
      const result = await payAccessFeeRequest(driverPhone);
      if (result.state) mergeAccess(result.state);

      if (result.state?.status === 'approved' || result.alreadyApproved) {
        return { ok: true, message: 'Approved. Opening the app.' };
      }

      if (result.awaitingConfirmation) {
        return { ok: true, message: 'Approve the payment in your Telebirr app to continue.' };
      }

      return { ok: false, message: result.reason || 'Could not start the payment.' };
    } catch (e) {
      return {
        ok: false,
        message: e instanceof Error ? e.message : 'Could not reach the payment server.',
      };
    } finally {
      setIsPaying(false);
    }
  }, [driverPhone, mergeAccess]);

  const verifyAccessPayment = useCallback(async (): Promise<{ ok: boolean; message: string }> => {
    if (!isValidPhone(driverPhone)) {
      return { ok: false, message: 'Enter your Telebirr number (09xxxxxxxx) first.' };
    }

    setIsVerifying(true);
    try {
      const result = await verifyAccessPaymentRequest(driverPhone);
      if (result.state) mergeAccess(result.state);

      if (result.approved || result.state?.status === 'approved') {
        return { ok: true, message: 'Payment confirmed. Opening the app.' };
      }

      return { ok: false, message: result.reason || 'Telebirr has not confirmed the payment yet.' };
    } catch (e) {
      return {
        ok: false,
        message: e instanceof Error ? e.message : 'Could not reach the payment server.',
      };
    } finally {
      setIsVerifying(false);
    }
  }, [driverPhone, mergeAccess]);

  // Ask the server whenever the number changes, once the stored one has loaded.
  useEffect(() => {
    if (!driverPhone) return;
    refreshAccess();
  }, [driverPhone, refreshAccess]);

  // Live unlock. The lock screen renders before the dashboard ever mounts, so the
  // socket is opened here rather than relying on TaxiContext doing it.
  useEffect(() => {
    socketService.connect();
    const unsubscribe = socketService.onAccessUpdated(applyAccessUpdate);
    return unsubscribe;
  }, [applyAccessUpdate]);

  const isAwaitingGateway = access?.status === 'pending' || access?.status === 'processing';

  useEffect(() => {
    if (!isAwaitingGateway) return;

    const timer = setInterval(() => {
      verifyAccessPayment().catch(() => {
        /* the socket or the next tick will try again */
      });
    }, ACCESS_POLL_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [isAwaitingGateway, verifyAccessPayment]);

  const hasAccess = access?.status === 'approved';

  const value = useMemo<AccessContextType>(
    () => ({
      driverPhone,
      setDriverPhone,
      access,
      hasAccess,
      isLoading,
      isPaying,
      isVerifying,
      refreshAccess,
      payAccessFee,
      verifyAccessPayment,
      applyAccessUpdate,
    }),
    [
      driverPhone,
      setDriverPhone,
      access,
      hasAccess,
      isLoading,
      isPaying,
      isVerifying,
      refreshAccess,
      payAccessFee,
      verifyAccessPayment,
      applyAccessUpdate,
    ],
  );

  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>;
};

export const useAccess = (): AccessContextType => {
  const context = useContext(AccessContext);
  if (!context) {
    throw new Error('useAccess must be used within an AccessProvider');
  }
  return context;
};
