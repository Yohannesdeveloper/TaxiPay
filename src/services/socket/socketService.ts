import { io, Socket } from 'socket.io-client';
import { Platform } from 'react-native';
import { LivePaymentEvent, Trip, Seat } from '../../types';

import Constants from 'expo-constants';

function resolveDefaultServerUrl(): string {
  if (Platform.OS === 'web') {
    return 'http://localhost:3000';
  }

  // Automatically detect the host PC's Wi-Fi IP from the active Expo session
  const hostUri = 
    Constants.expoConfig?.hostUri || 
    (Constants as any).manifest?.debuggerHost || 
    (Constants as any).manifest2?.extra?.expoClient?.hostUri;

  if (hostUri) {
    const ip = hostUri.split(':')[0];
    // If it's a valid LAN IP (e.g. 192.168.x.x), use it
    if (ip && ip !== 'localhost' && !ip.startsWith('127.') && !ip.includes('exp.direct')) {
      return `http://${ip}:3000`;
    }
  }

  // Direct active Wi-Fi IP of your PC
  return 'http://192.168.1.5:3000';
}

const DEFAULT_SERVER_URL = resolveDefaultServerUrl();

class TaxiSocketService {
  private socket: Socket | null = null;
  private currentTripId: string | null = null;
  private serverUrl: string = DEFAULT_SERVER_URL;
  private paymentListeners: Set<(payment: LivePaymentEvent) => void> = new Set();
  private isConnecting: boolean = false;

  public setServerUrl(url: string) {
    if (url && url !== this.serverUrl) {
      this.serverUrl = url;
      if (this.socket) {
        this.disconnect();
        this.connect();
      }
    }
  }

  public getServerUrl(): string {
    return this.serverUrl;
  }

  public connect(url?: string): Socket {
    if (url) {
      this.serverUrl = url;
    }

    if (this.socket && this.socket.connected) {
      return this.socket;
    }

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.isConnecting = true;
    console.log(`[TaxiSocket] Connecting to ${this.serverUrl}...`);

    this.socket = io(this.serverUrl, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      timeout: 10000,
    });

    this.socket.on('connect', () => {
      console.log('[TaxiSocket] Connected successfully:', this.socket?.id);
      this.isConnecting = false;
      if (this.currentTripId) {
        this.joinTrip(this.currentTripId);
      }
    });

    this.socket.on('connect_error', (err) => {
      console.warn('[TaxiSocket] Connection notice:', err.message);
      this.isConnecting = false;
    });

    // Handle seat_paid event
    this.socket.on('seat_paid', (data: LivePaymentEvent) => {
      console.log('[TaxiSocket] Realtime payment received:', data);
      this.notifyPaymentListeners(data);
    });

    this.socket.on('seat_paid_broadcast', (data: LivePaymentEvent) => {
      if (!this.currentTripId || data.tripId === this.currentTripId) {
        console.log('[TaxiSocket] Broadcast payment received:', data);
        this.notifyPaymentListeners(data);
      }
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[TaxiSocket] Disconnected:', reason);
    });

    return this.socket;
  }

  public joinTrip(tripId: string) {
    this.currentTripId = tripId;
    if (this.socket && this.socket.connected) {
      this.socket.emit('join_trip', tripId);
      console.log(`[TaxiSocket] Joined room for trip: ${tripId}`);
    }
  }

  public async syncTripWithServer(trip: Trip, seats: Seat[]): Promise<boolean> {
    try {
      const response = await fetch(`${this.serverUrl}/api/trips/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trip, seats }),
      });
      return response.ok;
    } catch (e) {
      // Offline or server not yet reachable; gracefully ignore
      return false;
    }
  }

  public onPaymentReceived(callback: (payment: LivePaymentEvent) => void): () => void {
    this.paymentListeners.add(callback);
    return () => {
      this.paymentListeners.delete(callback);
    };
  }

  private notifyPaymentListeners(payment: LivePaymentEvent) {
    this.paymentListeners.forEach((listener) => {
      try {
        listener(payment);
      } catch (err) {
        console.error('[TaxiSocket] Error in payment listener:', err);
      }
    });
  }

  public disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  public isConnected(): boolean {
    return !!(this.socket && this.socket.connected);
  }
}

export const socketService = new TaxiSocketService();
