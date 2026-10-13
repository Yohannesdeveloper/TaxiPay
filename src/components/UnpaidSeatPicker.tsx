import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { X, Armchair, CheckCircle2, Circle, QrCode } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import { useTranslation } from '../localization/useTranslation';
import { useTaxi } from '../state/TaxiContext';
import { Seat } from '../types';
import { formatCurrency } from '../utils/formatters';

interface UnpaidSeatPickerProps {
  visible: boolean;
  onClose: () => void;
  onSelectSeats: (seats: Seat[]) => void;
}

export const UnpaidSeatPicker: React.FC<UnpaidSeatPickerProps> = ({
  visible,
  onClose,
  onSelectSeats,
}) => {
  const { colors } = useTheme();
  const { t, language } = useTranslation();
  const { seats, trip } = useTaxi();

  // Seat ids currently ticked. A group can be paid with one QR, so selection is
  // multi-seat: the conductor ticks every passenger the payer is covering.
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const unpaidOrPendingSeats = seats.filter(s => s.status !== 'paid');

  // Start each visit with a clean selection.
  useEffect(() => {
    if (visible) setSelectedIds([]);
  }, [visible]);

  const toggleSeat = (seat: Seat) => {
    setSelectedIds(prev =>
      prev.includes(seat.id) ? prev.filter(id => id !== seat.id) : [...prev, seat.id],
    );
  };

  const selectedSeats = unpaidOrPendingSeats
    .filter(s => selectedIds.includes(s.id))
    .sort((a, b) => a.seatNumber - b.seatNumber);

  const totalFare = selectedSeats.length * trip.farePerSeat;

  const handleConfirm = () => {
    if (selectedSeats.length === 0) return;
    onClose();
    onSelectSeats(selectedSeats);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={[styles.backdrop, { backgroundColor: colors.modalOverlay }]}>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: colors.textPrimary }]}>
                {t.selectSeatsForQR}
              </Text>
              <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                {unpaidOrPendingSeats.length} {t.unpaid.toLowerCase()} {t.seat.toLowerCase()}s
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.closeBtn, { backgroundColor: colors.surfaceElevated }]}
              onPress={onClose}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={t.close}
            >
              <X size={20} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {unpaidOrPendingSeats.length === 0 ? (
            <View style={styles.emptyContainer}>
              <CheckCircle2 size={48} color={colors.paidText} />
              <Text style={[styles.emptyText, { color: colors.textPrimary }]}>
                {t.noUnpaidSeats}
              </Text>
            </View>
          ) : (
            <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
              {unpaidOrPendingSeats.map(seat => {
                const isPending = seat.status === 'pending';
                const isSelected = selectedIds.includes(seat.id);
                const statusColor = isPending ? colors.pendingText : colors.textSecondary;
                const statusLabel = isPending ? t.pending : t.unpaid;

                return (
                  <TouchableOpacity
                    key={seat.id}
                    style={[
                      styles.seatItem,
                      {
                        backgroundColor: isSelected ? colors.paidBg : colors.surfaceElevated,
                        borderColor: isSelected
                          ? colors.primaryLime
                          : isPending
                          ? colors.pendingBorder
                          : colors.borderSubtle,
                      },
                    ]}
                    onPress={() => toggleSeat(seat)}
                    activeOpacity={0.7}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isSelected }}
                    accessibilityLabel={`${t.seat} ${seat.seatNumber}`}
                  >
                    <View style={styles.seatItemLeft}>
                      <View style={[styles.iconWrap, { backgroundColor: colors.surface }]}>
                        <Armchair size={18} color={statusColor} />
                      </View>
                      <View>
                        <Text style={[styles.seatNum, { color: colors.textPrimary }]}>
                          {t.seat} #{seat.seatNumber}
                        </Text>
                        <Text style={[styles.seatStatusText, { color: statusColor }]}>
                          {statusLabel} • {formatCurrency(trip.farePerSeat, language)}
                        </Text>
                      </View>
                    </View>

                    {isSelected ? (
                      <CheckCircle2 size={22} color={colors.primaryLime} />
                    ) : (
                      <Circle size={22} color={colors.textMuted} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {/* Confirm group payment */}
          {selectedSeats.length > 0 ? (
            <TouchableOpacity
              style={[styles.payBtn, { backgroundColor: colors.primaryLime }]}
              onPress={handleConfirm}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={t.payForSeats.replace('{count}', String(selectedSeats.length))}
            >
              <QrCode size={18} color={colors.primaryLimeText} />
              <Text style={[styles.payBtnText, { color: colors.primaryLimeText }]}>
                {t.payForSeats.replace('{count}', String(selectedSeats.length))} •{' '}
                {formatCurrency(totalFare, language)}
              </Text>
            </TouchableOpacity>
          ) : (
            <Text style={[styles.hint, { color: colors.textMuted }]}>
              {t.selectSeatsHint}
            </Text>
          )}

          {/* Close button */}
          <TouchableOpacity
            style={[styles.doneBtn, { backgroundColor: colors.surfaceElevated }]}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Text style={[styles.doneBtnText, { color: colors.textPrimary }]}>
              {t.close}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  card: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '85%',
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  list: {
    maxHeight: 340,
  },
  listContent: {
    gap: 8,
    paddingBottom: 10,
  },
  seatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    minHeight: 52,
  },
  seatItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seatNum: {
    fontSize: 15,
    fontWeight: '700',
  },
  seatStatusText: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  hint: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 14,
    paddingHorizontal: 10,
  },
  payBtn: {
    height: 52,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 14,
  },
  payBtnText: {
    fontSize: 15,
    fontWeight: '800',
  },
  doneBtn: {
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  doneBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
