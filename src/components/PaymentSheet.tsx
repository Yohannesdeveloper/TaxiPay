import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import {
  X,
  CheckCircle2,
  AlertCircle,
  Clock,
  WifiOff,
  Sparkles,
  RotateCcw,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import { useTranslation } from '../localization/useTranslation';
import { useTaxi } from '../state/TaxiContext';
import { formatCurrency } from '../utils/formatters';

export const PaymentSheet: React.FC = () => {
  const { colors } = useTheme();
  const { t, language } = useTranslation();
  const {
    activeSheetSeat,
    closePaymentSheet,
    confirmActiveSeatPayment,
    failActiveSeatPayment,
    timeoutActiveSeatPayment,
    resetActiveSeatToUnpaid,
    trip,
  } = useTaxi();

  if (!activeSheetSeat) return null;

  const payment = activeSheetSeat.activePayment;
  const status = payment?.status || 'pending';
  const qrString = payment?.qrPayloadString || `TAXIPAY-DEMO:seat=${activeSheetSeat.seatNumber}`;

  // Status visual attributes
  let statusBadgeBg = colors.pendingBadgeBg;
  let statusBadgeText = colors.pendingText;
  let StatusIcon = Clock;
  let statusTitle = t.statusAwaiting;

  if (activeSheetSeat.status === 'paid' || status === 'confirmed') {
    statusBadgeBg = colors.paidBadgeBg;
    statusBadgeText = colors.paidText;
    StatusIcon = CheckCircle2;
    statusTitle = t.statusConfirmed;
  } else if (status === 'failed') {
    statusBadgeBg = colors.dangerLight;
    statusBadgeText = colors.danger;
    StatusIcon = AlertCircle;
    statusTitle = t.statusFailed;
  } else if (status === 'expired') {
    statusBadgeBg = colors.warningLight;
    statusBadgeText = colors.warning;
    StatusIcon = AlertCircle;
    statusTitle = t.statusExpired;
  } else if (status === 'offline') {
    statusBadgeBg = colors.surfaceElevated;
    statusBadgeText = colors.textMuted;
    StatusIcon = WifiOff;
    statusTitle = t.statusOffline;
  }

  return (
    <Modal
      visible={!!activeSheetSeat}
      animationType="slide"
      transparent={true}
      onRequestClose={closePaymentSheet}
    >
      <View style={[styles.modalBackdrop, { backgroundColor: colors.modalOverlay }]}>
        <View style={[styles.sheetContainer, { backgroundColor: colors.surface }]}>
          {/* Sheet Drag Handle */}
          <View style={styles.handleWrap}>
            <View style={[styles.handleBar, { backgroundColor: colors.borderSubtle }]} />
          </View>

          {/* Header */}
          <View style={styles.headerRow}>
            <View>
              <Text style={[styles.seatTitle, { color: colors.textPrimary }]}>
                {t.seat} #{activeSheetSeat.seatNumber}
              </Text>
              <Text style={[styles.routeSubtitle, { color: colors.textMuted }]}>
                {trip.routeName} • {trip.plateNumber}
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.closeButton, { backgroundColor: colors.surfaceElevated }]}
              onPress={closePaymentSheet}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={t.close}
            >
              <X size={20} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Fare Highlight Card */}
            <View style={[styles.fareCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.borderSubtle }]}>
              <View>
                <Text style={[styles.fareLabel, { color: colors.textMuted }]}>
                  {t.passengerFare}
                </Text>
                <Text style={[styles.fareValue, { color: colors.primaryForest }]}>
                  {formatCurrency(trip.farePerSeat, language)}
                </Text>
              </View>
              <View style={[styles.attemptPill, { backgroundColor: colors.surface }]}>
                <Text style={[styles.attemptText, { color: colors.textSecondary }]}>
                  {payment?.id || `S${activeSheetSeat.seatNumber}`}
                </Text>
              </View>
            </View>

            {/* QR Frame Container */}
            <View style={[styles.qrContainer, { backgroundColor: '#FFFFFF', borderColor: colors.cardBorder }]}>
              {/* Telebirr Demo Watermark Header */}
              <View style={styles.telebirrHeader}>
                <View style={styles.telebirrBadge}>
                  <Text style={styles.telebirrBrandText}>telebirr</Text>
                  <View style={styles.demoBadge}>
                    <Text style={styles.demoBadgeText}>SIMULATED</Text>
                  </View>
                </View>
              </View>

              {/* QR Code Graphic */}
              <View style={styles.qrWrapper}>
                <QRCode
                  value={qrString}
                  size={190}
                  color="#111827"
                  backgroundColor="#FFFFFF"
                />
              </View>

              {/* Disclaimer */}
              <View style={styles.disclaimerBox}>
                <ShieldAlert size={12} color="#6B7280" />
                <Text style={styles.disclaimerText}>
                  Mock sandbox QR for developer demo testing only.
                </Text>
              </View>
            </View>

            {/* Live Status Indicator */}
            <View style={[styles.statusBanner, { backgroundColor: statusBadgeBg }]}>
              <StatusIcon size={18} color={statusBadgeText} />
              <View style={styles.statusTextWrap}>
                <Text style={[styles.statusBannerTitle, { color: statusBadgeText }]}>
                  {statusTitle}
                </Text>
                {payment?.transactionRef && (
                  <Text style={[styles.statusBannerSub, { color: statusBadgeText }]}>
                    Ref: {payment.transactionRef}
                  </Text>
                )}
                {payment?.errorMessage && (
                  <Text style={[styles.statusBannerSub, { color: statusBadgeText }]}>
                    {payment.errorMessage}
                  </Text>
                )}
              </View>
            </View>

            {/* Simulation Controls Section */}
            <View style={[styles.simControlsCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.borderSubtle }]}>
              <View style={styles.simControlsHeader}>
                <Sparkles size={15} color={colors.primaryForest} />
                <Text style={[styles.simControlsTitle, { color: colors.textPrimary }]}>
                  Conductor Simulation Controls
                </Text>
              </View>
              <Text style={[styles.simControlsSub, { color: colors.textMuted }]}>
                Test backend telebirr gateway responses without real funds:
              </Text>

              {/* Action 1: Confirm payment */}
              {activeSheetSeat.status !== 'paid' && (
                <TouchableOpacity
                  style={[styles.primaryActionBtn, { backgroundColor: colors.primaryLime }]}
                  onPress={confirmActiveSeatPayment}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={t.simulateSuccess}
                >
                  <CheckCircle2 size={18} color={colors.primaryLimeText} />
                  <Text style={[styles.primaryActionBtnText, { color: colors.primaryLimeText }]}>
                    {t.simulateSuccess}
                  </Text>
                  <ArrowRight size={16} color={colors.primaryLimeText} />
                </TouchableOpacity>
              )}

              {/* Secondary Simulation Buttons */}
              <View style={styles.simRow}>
                {activeSheetSeat.status !== 'paid' && (
                  <TouchableOpacity
                    style={[styles.simOutlineBtn, { borderColor: colors.borderSubtle, backgroundColor: colors.surface }]}
                    onPress={() => failActiveSeatPayment()}
                    activeOpacity={0.7}
                  >
                    <AlertCircle size={14} color={colors.danger} />
                    <Text style={[styles.simOutlineBtnText, { color: colors.danger }]}>
                      {t.simulateFail}
                    </Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[styles.simOutlineBtn, { borderColor: colors.borderSubtle, backgroundColor: colors.surface }]}
                  onPress={resetActiveSeatToUnpaid}
                  activeOpacity={0.7}
                >
                  <RotateCcw size={14} color={colors.textSecondary} />
                  <Text style={[styles.simOutlineBtnText, { color: colors.textSecondary }]}>
                    {t.simulateReset}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Close Button */}
            <TouchableOpacity
              style={[styles.doneButton, { backgroundColor: colors.surfaceElevated }]}
              onPress={closePaymentSheet}
              activeOpacity={0.7}
            >
              <Text style={[styles.doneButtonText, { color: colors.textPrimary }]}>
                {t.close}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '90%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  handleWrap: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  handleBar: {
    width: 44,
    height: 5,
    borderRadius: 3,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  seatTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  routeSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  fareCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  fareLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  fareValue: {
    fontSize: 22,
    fontWeight: '800',
  },
  attemptPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  attemptText: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  qrContainer: {
    alignItems: 'center',
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  telebirrHeader: {
    marginBottom: 12,
  },
  telebirrBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0F9FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  telebirrBrandText: {
    color: '#0284C7',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  demoBadge: {
    backgroundColor: '#FEF08A',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  demoBadgeText: {
    color: '#854D0E',
    fontSize: 9,
    fontWeight: '800',
  },
  qrWrapper: {
    padding: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
  },
  disclaimerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 12,
  },
  disclaimerText: {
    fontSize: 10,
    color: '#6B7280',
    fontWeight: '500',
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 14,
    marginBottom: 16,
  },
  statusTextWrap: {
    flex: 1,
  },
  statusBannerTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  statusBannerSub: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  simControlsCard: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 14,
  },
  simControlsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  simControlsTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  simControlsSub: {
    fontSize: 11,
    marginBottom: 12,
  },
  primaryActionBtn: {
    height: 48,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 10,
  },
  primaryActionBtnText: {
    fontSize: 14,
    fontWeight: '800',
  },
  simRow: {
    flexDirection: 'row',
    gap: 8,
  },
  simOutlineBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  simOutlineBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  doneButton: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
