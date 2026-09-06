import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import {
  Navigation,
  ShieldCheck,
  Banknote,
  Users,
  RefreshCw,
  SlidersHorizontal,
  Edit3,
} from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import { useTranslation } from '../localization/useTranslation';
import { useTaxi } from '../state/TaxiContext';
import { formatCurrency, formatPlate } from '../utils/formatters';
import { EditPlateModal } from './EditPlateModal';

interface TripSummaryProps {
  onOpenTripConfig: () => void;
  onNewTripPress: () => void;
}

export const TripSummary: React.FC<TripSummaryProps> = ({ onOpenTripConfig, onNewTripPress }) => {
  const { colors } = useTheme();
  const { t, language } = useTranslation();
  const { trip, collectedTotal, paidCount, seats, pendingCount } = useTaxi();

  const [isEditPlateOpen, setIsEditPlateOpen] = useState(false);

  const totalSeats = seats.length;
  const progressPercent = totalSeats > 0 ? Math.round((paidCount / totalSeats) * 100) : 0;

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
      {/* Top Banner: Route & Plate */}
      <View style={styles.topRow}>
        <TouchableOpacity
          style={styles.routeContainer}
          onPress={onOpenTripConfig}
          activeOpacity={0.7}
        >
          <View style={[styles.iconPill, { backgroundColor: colors.surfaceElevated }]}>
            <Navigation size={16} color={colors.primaryForest} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.subLabel, { color: colors.textMuted }]}>{t.route}</Text>
            <Text style={[styles.routeText, { color: colors.textPrimary }]} numberOfLines={1}>
              {trip.routeName}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Editable Plate Badge - Tap to edit car number */}
        <TouchableOpacity
          style={[styles.plateBadge, { backgroundColor: colors.surfaceElevated, borderColor: colors.borderSubtle }]}
          onPress={() => setIsEditPlateOpen(true)}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel="Edit car plate number"
        >
          <View style={styles.plateRow}>
            <Text style={[styles.plateText, { color: colors.textPrimary }]}>
              {formatPlate(trip.plateNumber)}
            </Text>
            <Edit3 size={12} color={colors.primaryForest} />
          </View>
        </TouchableOpacity>
      </View>

      {/* Divider */}
      <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />

      {/* Metrics Row */}
      <View style={styles.metricsRow}>
        {/* Metric 1: Collected Amount */}
        <View style={styles.metricItem}>
          <View style={styles.metricHeader}>
            <Banknote size={15} color={colors.primaryForest} />
            <Text style={[styles.metricLabel, { color: colors.textMuted }]}>
              {t.collectedAmount}
            </Text>
          </View>
          <Text style={[styles.metricValueLarge, { color: colors.paidText }]}>
            {formatCurrency(collectedTotal, language)}
          </Text>
        </View>

        {/* Metric 2: Fare per seat */}
        <View style={styles.metricItem}>
          <View style={styles.metricHeader}>
            <ShieldCheck size={15} color={colors.textSecondary} />
            <Text style={[styles.metricLabel, { color: colors.textMuted }]}>
              {t.farePerSeat}
            </Text>
          </View>
          <Text style={[styles.metricValue, { color: colors.textPrimary }]}>
            {formatCurrency(trip.farePerSeat, language)}
          </Text>
        </View>

        {/* Metric 3: Paid Seats */}
        <View style={styles.metricItem}>
          <View style={styles.metricHeader}>
            <Users size={15} color={colors.textSecondary} />
            <Text style={[styles.metricLabel, { color: colors.textMuted }]}>
              {t.paidSeats}
            </Text>
          </View>
          <View style={styles.paidCountRow}>
            <Text style={[styles.metricValue, { color: colors.textPrimary }]}>
              {paidCount}
              <Text style={{ color: colors.textMuted, fontSize: 13, fontWeight: '400' }}>/{totalSeats}</Text>
            </Text>
            {pendingCount > 0 && (
              <View style={[styles.pendingPill, { backgroundColor: colors.pendingBadgeBg }]}>
                <Text style={[styles.pendingPillText, { color: colors.pendingText }]}>
                  {pendingCount} {t.pending.toLowerCase()}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Visual Progress Bar */}
      <View style={styles.progressSection}>
        <View style={[styles.progressBarBg, { backgroundColor: colors.surfaceElevated }]}>
          <View
            style={[
              styles.progressBarFill,
              {
                width: `${progressPercent}%`,
                backgroundColor: colors.primaryLime,
              },
            ]}
          />
        </View>
        <View style={styles.progressLabels}>
          <Text style={[styles.progressText, { color: colors.textMuted }]}>
            {progressPercent}% {t.paid.toLowerCase()}
          </Text>
          <View style={styles.actionButtonsRow}>
            <TouchableOpacity
              style={[styles.smallBtn, { backgroundColor: colors.surfaceElevated }]}
              onPress={onOpenTripConfig}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={t.configureTrip}
            >
              <SlidersHorizontal size={13} color={colors.textSecondary} />
              <Text style={[styles.smallBtnText, { color: colors.textSecondary }]}>
                {t.configureTrip}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.smallBtn, { backgroundColor: colors.primaryLime }]}
              onPress={onNewTripPress}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={t.newTrip}
            >
              <RefreshCw size={13} color={colors.primaryLimeText} />
              <Text style={[styles.smallBtnText, { color: colors.primaryLimeText, fontWeight: '700' }]}>
                {t.newTrip}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Dedicated Car Number Edit Modal */}
      <EditPlateModal
        visible={isEditPlateOpen}
        onClose={() => setIsEditPlateOpen(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 8,
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  routeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  iconPill: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subLabel: {
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  routeText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  plateBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    marginLeft: 8,
  },
  plateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  plateText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  divider: {
    height: 1,
    marginVertical: 14,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  metricItem: {
    flex: 1,
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  metricValueLarge: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  paidCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  pendingPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  pendingPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  progressSection: {
    marginTop: 14,
  },
  progressBarBg: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressLabels: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    flexWrap: 'wrap',
    gap: 6,
  },
  progressText: {
    fontSize: 11,
    fontWeight: '600',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  smallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8,
    minHeight: 32,
  },
  smallBtnText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
