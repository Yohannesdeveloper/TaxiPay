import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { CheckCircle2, X, ShieldCheck, Ticket } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import { useTranslation } from '../localization/useTranslation';
import { useTaxi } from '../state/TaxiContext';
import { formatCurrency, formatPlate } from '../utils/formatters';

export const ReceiptModal: React.FC = () => {
  const { colors } = useTheme();
  const { t, language } = useTranslation();
  const { activeReceipt, closeReceiptModal } = useTaxi();

  if (!activeReceipt) return null;

  return (
    <Modal
      visible={!!activeReceipt}
      animationType="fade"
      transparent={true}
      onRequestClose={closeReceiptModal}
    >
      <View style={[styles.backdrop, { backgroundColor: colors.modalOverlay }]}>
        <View style={[styles.ticketContainer, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
          {/* Header */}
          <View style={[styles.ticketHeader, { backgroundColor: colors.paidBg }]}>
            <View style={styles.verifiedBadge}>
              <CheckCircle2 size={24} color={colors.paidText} strokeWidth={2.5} />
              <View>
                <Text style={[styles.receiptTitle, { color: colors.paidText }]}>
                  {t.receiptTitle}
                </Text>
                <Text style={[styles.verifiedSub, { color: colors.paidText }]}>
                  {t.receiptVerifiedText}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.closeIconBtn}
              onPress={closeReceiptModal}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={t.close}
            >
              <X size={20} color={colors.paidText} />
            </TouchableOpacity>
          </View>

          {/* Ticket Body */}
          <View style={styles.ticketBody}>
            {/* Amount Large */}
            <View style={styles.amountWrap}>
              <Text style={[styles.amountLabel, { color: colors.textMuted }]}>{t.amount}</Text>
              <Text style={[styles.amountValue, { color: colors.textPrimary }]}>
                {formatCurrency(activeReceipt.fare, language)}
              </Text>
            </View>

            {/* Dashed Separator */}
            <View style={styles.dashedContainer}>
              <View style={[styles.cutoutCircleLeft, { backgroundColor: colors.modalOverlay }]} />
              <View style={[styles.dashedLine, { borderColor: colors.borderSubtle }]} />
              <View style={[styles.cutoutCircleRight, { backgroundColor: colors.modalOverlay }]} />
            </View>

            {/* Receipt Details Grid */}
            <View style={styles.detailsList}>
              <View style={styles.detailRow}>
                <Text style={[styles.detailKey, { color: colors.textMuted }]}>{t.seatNumber}</Text>
                <Text style={[styles.detailVal, { color: colors.textPrimary }]}>
                  {t.seat} #{activeReceipt.seatNumber}
                </Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={[styles.detailKey, { color: colors.textMuted }]}>{t.route}</Text>
                <Text style={[styles.detailVal, { color: colors.textPrimary }]}>
                  {activeReceipt.routeName}
                </Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={[styles.detailKey, { color: colors.textMuted }]}>{t.vehiclePlate}</Text>
                <Text style={[styles.detailVal, { color: colors.textPrimary }]}>
                  {formatPlate(activeReceipt.plateNumber)}
                </Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={[styles.detailKey, { color: colors.textMuted }]}>{t.txRef}</Text>
                <Text style={[styles.detailValMonospace, { color: colors.primaryForest }]}>
                  {activeReceipt.transactionRef}
                </Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={[styles.detailKey, { color: colors.textMuted }]}>{t.paidAt}</Text>
                <Text style={[styles.detailVal, { color: colors.textPrimary }]}>
                  {activeReceipt.paidAt}
                </Text>
              </View>
            </View>

            {/* Telebirr Verified Pill */}
            <View style={[styles.gatewayBanner, { backgroundColor: colors.surfaceElevated }]}>
              <ShieldCheck size={16} color={colors.telebirrBlue} />
              <Text style={[styles.gatewayText, { color: colors.textSecondary }]}>
                telebirr digital receipt confirmed via TaxiPay Gateway
              </Text>
            </View>

            {/* Done Action */}
            <TouchableOpacity
              style={[styles.doneBtn, { backgroundColor: colors.primaryLime }]}
              onPress={closeReceiptModal}
              activeOpacity={0.8}
            >
              <Text style={[styles.doneBtnText, { color: colors.primaryLimeText }]}>
                {t.done}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  ticketContainer: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },
  ticketHeader: {
    paddingHorizontal: 20,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  receiptTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  verifiedSub: {
    fontSize: 12,
    fontWeight: '600',
    opacity: 0.9,
  },
  closeIconBtn: {
    padding: 4,
  },
  ticketBody: {
    padding: 20,
  },
  amountWrap: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  amountLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  amountValue: {
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -1,
    marginTop: 2,
  },
  dashedContainer: {
    position: 'relative',
    height: 30,
    justifyContent: 'center',
    marginHorizontal: -20,
  },
  cutoutCircleLeft: {
    position: 'absolute',
    left: -12,
    width: 24,
    height: 24,
    borderRadius: 12,
    zIndex: 2,
  },
  cutoutCircleRight: {
    position: 'absolute',
    right: -12,
    width: 24,
    height: 24,
    borderRadius: 12,
    zIndex: 2,
  },
  dashedLine: {
    borderWidth: 1,
    borderStyle: 'dashed',
    marginHorizontal: 16,
  },
  detailsList: {
    gap: 12,
    marginTop: 6,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailKey: {
    fontSize: 13,
    fontWeight: '500',
  },
  detailVal: {
    fontSize: 14,
    fontWeight: '700',
  },
  detailValMonospace: {
    fontSize: 13,
    fontWeight: '800',
  },
  gatewayBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  gatewayText: {
    fontSize: 11,
    fontWeight: '500',
    flex: 1,
  },
  doneBtn: {
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBtnText: {
    fontSize: 15,
    fontWeight: '800',
  },
});
