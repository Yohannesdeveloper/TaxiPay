import AsyncStorage from '@react-native-async-storage/async-storage';
import { Seat, Trip, Receipt } from '../types';

const STORAGE_KEYS = {
  SEAT_CAPACITY: '@taxipay_seat_capacity',
  ACTIVE_SEATS: '@taxipay_active_seats',
  ACTIVE_TRIP: '@taxipay_active_trip',
  PLATE_NUMBER: '@taxipay_plate_number',
  RECEIPTS_ARCHIVE: '@taxipay_receipts_archive',
  DRIVER_PHONE: '@taxipay_driver_phone',
};

export const saveCapacity = async (count: number): Promise<void> => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.SEAT_CAPACITY, count.toString());
  } catch (e) {
    console.warn('Failed to save capacity', e);
  }
};

export const loadCapacity = async (): Promise<number | null> => {
  try {
    const val = await AsyncStorage.getItem(STORAGE_KEYS.SEAT_CAPACITY);
    return val ? parseInt(val, 10) : null;
  } catch (e) {
    console.warn('Failed to load capacity', e);
    return null;
  }
};

export const saveSeats = async (seats: Seat[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_SEATS, JSON.stringify(seats));
  } catch (e) {
    console.warn('Failed to save seats', e);
  }
};

export const loadSeats = async (): Promise<Seat[] | null> => {
  try {
    const val = await AsyncStorage.getItem(STORAGE_KEYS.ACTIVE_SEATS);
    return val ? JSON.parse(val) : null;
  } catch (e) {
    console.warn('Failed to load seats', e);
    return null;
  }
};

export const saveTrip = async (trip: Trip): Promise<void> => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_TRIP, JSON.stringify(trip));
  } catch (e) {
    console.warn('Failed to save trip', e);
  }
};

export const loadTrip = async (): Promise<Trip | null> => {
  try {
    const val = await AsyncStorage.getItem(STORAGE_KEYS.ACTIVE_TRIP);
    return val ? JSON.parse(val) : null;
  } catch (e) {
    console.warn('Failed to load trip', e);
    return null;
  }
};

export const savePlateNumber = async (plate: string): Promise<void> => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.PLATE_NUMBER, plate);
  } catch (e) {
    console.warn('Failed to save plate number', e);
  }
};

export const loadPlateNumber = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(STORAGE_KEYS.PLATE_NUMBER);
  } catch (e) {
    console.warn('Failed to load plate number', e);
    return null;
  }
};

export const saveReceipts = async (receipts: Receipt[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.RECEIPTS_ARCHIVE, JSON.stringify(receipts));
  } catch (e) {
    console.warn('Failed to save receipts', e);
  }
};

export const loadReceipts = async (): Promise<Receipt[]> => {
  try {
    const val = await AsyncStorage.getItem(STORAGE_KEYS.RECEIPTS_ARCHIVE);
    return val ? JSON.parse(val) : [];
  } catch (e) {
    console.warn('Failed to load receipts', e);
    return [];
  }
};

export const saveDriverPhone = async (phone: string): Promise<void> => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.DRIVER_PHONE, phone);
  } catch (e) {
    console.warn('Failed to save driver phone', e);
  }
};

export const loadDriverPhone = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(STORAGE_KEYS.DRIVER_PHONE);
  } catch (e) {
    console.warn('Failed to load driver phone', e);
    return null;
  }
};
