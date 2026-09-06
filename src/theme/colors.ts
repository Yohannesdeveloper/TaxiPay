export interface ThemeColors {
  background: string;
  surface: string;
  surfaceElevated: string;
  cardBorder: string;
  borderSubtle: string;

  headerBackground: string;
  headerText: string;
  headerSubtext: string;

  primaryForest: string;
  primaryLime: string;
  primaryLimePressed: string;
  primaryLimeText: string;

  textPrimary: string;
  textSecondary: string;
  textMuted: string;

  // Seat status colors
  paidBg: string;
  paidBorder: string;
  paidText: string;
  paidBadgeBg: string;

  pendingBg: string;
  pendingBorder: string;
  pendingText: string;
  pendingBadgeBg: string;

  unpaidBg: string;
  unpaidBorder: string;
  unpaidText: string;
  unpaidBadgeBg: string;

  // Accents
  telebirrBlue: string;
  danger: string;
  dangerLight: string;
  warning: string;
  warningLight: string;
  info: string;
  infoLight: string;
  modalOverlay: string;
}

export const lightColors: ThemeColors = {
  background: '#FAF7F2', // warm cream
  surface: '#FFFFFF',
  surfaceElevated: '#F2EDE4',
  cardBorder: '#E7E0D3',
  borderSubtle: '#EAE4D8',

  headerBackground: '#133E2B', // forest green
  headerText: '#FFFFFF',
  headerSubtext: '#A7C8B5',

  primaryForest: '#133E2B',
  primaryLime: '#74B816', // vibrant lime
  primaryLimePressed: '#5C940E',
  primaryLimeText: '#102A1C',

  textPrimary: '#18261E',
  textSecondary: '#52665B',
  textMuted: '#7D9186',

  // Paid: soft green
  paidBg: '#EAF8EE',
  paidBorder: '#84D89D',
  paidText: '#145A32',
  paidBadgeBg: '#D1F2D9',

  // Pending: soft amber
  pendingBg: '#FEF9E7',
  pendingBorder: '#F9E79F',
  pendingText: '#7D6608',
  pendingBadgeBg: '#FCF3CF',

  // Unpaid: neutral surface
  unpaidBg: '#FFFFFF',
  unpaidBorder: '#DFD8CB',
  unpaidText: '#46564E',
  unpaidBadgeBg: '#EFEAE1',

  telebirrBlue: '#007ACC',
  danger: '#C0392B',
  dangerLight: '#FDEDEC',
  warning: '#D68910',
  warningLight: '#FEF5E7',
  info: '#2471A3',
  infoLight: '#EAF2F8',
  modalOverlay: 'rgba(15, 23, 19, 0.65)',
};

export const darkColors: ThemeColors = {
  background: '#101613',
  surface: '#17221C',
  surfaceElevated: '#1F2E26',
  cardBorder: '#273B30',
  borderSubtle: '#213128',

  headerBackground: '#0B1E15',
  headerText: '#F0F7F3',
  headerSubtext: '#839C8F',

  primaryForest: '#1D4E37',
  primaryLime: '#84CC16',
  primaryLimePressed: '#65A30D',
  primaryLimeText: '#0A1E13',

  textPrimary: '#F2F7F4',
  textSecondary: '#A2B8AC',
  textMuted: '#6E8377',

  // Paid
  paidBg: '#0F2B1B',
  paidBorder: '#1E5E3A',
  paidText: '#86EFAC',
  paidBadgeBg: '#154129',

  // Pending
  pendingBg: '#2E250A',
  pendingBorder: '#5C4A11',
  pendingText: '#FDE047',
  pendingBadgeBg: '#44370D',

  // Unpaid
  unpaidBg: '#17221C',
  unpaidBorder: '#293C31',
  unpaidText: '#C4D6CD',
  unpaidBadgeBg: '#223229',

  telebirrBlue: '#38BDF8',
  danger: '#E74C3C',
  dangerLight: '#3A1412',
  warning: '#F39C12',
  warningLight: '#3D2808',
  info: '#3498DB',
  infoLight: '#0E2838',
  modalOverlay: 'rgba(0, 0, 0, 0.75)',
};
