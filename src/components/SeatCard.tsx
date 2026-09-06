import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { CheckCircle2, Clock, Circle, Armchair, ArrowUpRight } from 'lucide-react-native';
import { Seat } from '../types';
import { useTheme } from '../theme/ThemeContext';
import { useTranslation } from '../localization/useTranslation';

interface SeatCardProps {
  seat: Seat;
  onPress: (seat: Seat) => void;
}

export const SeatCard: React.FC<SeatCardProps> = ({ seat, onPress }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();

  // Status configuration
  let cardBg = colors.unpaidBg;
  let cardBorder = colors.unpaidBorder;
  let textStatusColor = colors.unpaidText;
  let statusText = t.unpaid;
  let StatusIcon = Circle;
  let iconColor = colors.textMuted;
  let badgeBg = colors.unpaidBadgeBg;

  if (seat.status === 'paid') {
    cardBg = colors.paidBg;
    cardBorder = colors.paidBorder;
    textStatusColor = colors.paidText;
    statusText = t.paid;
    StatusIcon = CheckCircle2;
    iconColor = colors.paidText;
    badgeBg = colors.paidBadgeBg;
  } else if (seat.status === 'pending') {
    cardBg = colors.pendingBg;
    cardBorder = colors.pendingBorder;
    textStatusColor = colors.pendingText;
    statusText = t.pending;
    StatusIcon = Clock;
    iconColor = colors.pendingText;
    badgeBg = colors.pendingBadgeBg;
  }

  const accessibilityHint = 
    seat.status === 'paid' 
      ? t.tapToViewReceipt 
      : seat.status === 'pending'
      ? t.waitingConfirmation
      : t.tapToCollect;

  return (
    <TouchableOpacity
      style={[
        styles.card,
        {
          backgroundColor: cardBg,
          borderColor: cardBorder,
        },
      ]}
      onPress={() => onPress(seat)}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={`${t.seat} ${seat.seatNumber}, ${statusText}`}
      accessibilityHint={accessibilityHint}
    >
      {/* Top row: Seat Icon & Number */}
      <View style={styles.headerRow}>
        <View style={[styles.seatIconWrap, { backgroundColor: badgeBg }]}>
          <Armchair size={17} color={textStatusColor} strokeWidth={2.2} />
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[styles.seatNumberText, { color: colors.textPrimary }]}>
            #{seat.seatNumber}
          </Text>
          {seat.label && seat.label !== `Seat ${seat.seatNumber}` ? (
            <Text style={{ fontSize: 10, fontWeight: '600', color: colors.textMuted }} numberOfLines={1}>
              {seat.label}
            </Text>
          ) : null}
        </View>
      </View>

      {/* Center/Bottom: Status badge and indicator */}
      <View style={styles.footerRow}>
        <View style={styles.statusRow}>
          <StatusIcon size={14} color={iconColor} strokeWidth={2.4} />
          <Text style={[styles.statusText, { color: textStatusColor }]}>
            {statusText}
          </Text>
        </View>

        <View style={styles.actionAffordance}>
          <ArrowUpRight size={13} color={colors.textMuted} />
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minHeight: 96,
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 12,
    margin: 5,
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  seatIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seatNumberText: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  actionAffordance: {
    opacity: 0.6,
  },
});
