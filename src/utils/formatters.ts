import { Language } from '../types';

export const formatCurrency = (amount: number, language: Language = 'en'): string => {
  if (language === 'am') {
    return `${amount.toLocaleString()} ብር`;
  }
  return `${amount.toLocaleString()} ETB`;
};

export const formatPlate = (plate: string): string => {
  return plate.toUpperCase();
};
