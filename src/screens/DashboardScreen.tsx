import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { QrCode, ShieldCheck, Sparkles, AlertTriangle } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import { useTranslation } from '../localization/useTranslation';
import { useTaxi } from '../state/TaxiContext';
import { Header } from '../components/Header';
import { TripSummary } from '../components/TripSummary';
import { SeatGrid } from '../components/SeatGrid';
import { PaymentSheet } from '../components/PaymentSheet';
import { ReceiptModal } from '../components/ReceiptModal';
import { SeatManagerModal } from '../components/SeatManagerModal';
import { TripConfigModal } from '../components/TripConfigModal';
import { UnpaidSeatPicker } from '../components/UnpaidSeatPicker';
import { Seat } from '../types';

interface DashboardScreenProps {
  onOpenAccessAdmin?: () => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({ onOpenAccessAdmin }) => {
  const { colors, mode } = useTheme();
  const { t } = useTranslation();
  const { seats, openPaymentSheet, openGroupPaymentSheet, openReceiptModal } = useTaxi();

  const [isSeatManagerOpen, setIsSeatManagerOpen] = useState(false);
  const [isTripConfigOpen, setIsTripConfigOpen] = useState(false);
  const [isUnpaidPickerOpen, setIsUnpaidPickerOpen] = useState(false);

  const handleSeatPress = (seat: Seat) => {
    if (seat.status === 'paid') {
      openReceiptModal(seat);
    } else {
      openPaymentSheet(seat);
    }
  };

  const handleSelectSeatsFromPicker = (selected: Seat[]) => {
    openGroupPaymentSheet(selected);
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.headerBackground }]}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={colors.headerBackground}
      />
      <View style={[styles.mainContainer, { backgroundColor: colors.background }]}>
        {/* Top App Header */}
        <Header
          onOpenSeatManager={() => setIsSeatManagerOpen(true)}
          onOpenTripConfig={() => setIsTripConfigOpen(true)}
          onOpenAccessAdmin={onOpenAccessAdmin}
        />

        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Trip Summary Card */}
          <TripSummary
            onOpenTripConfig={() => setIsTripConfigOpen(true)}
            onNewTripPress={() => setIsTripConfigOpen(true)}
          />

          {/* Section Heading: Passenger Seats */}
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderLeft}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                {t.totalCapacity}
              </Text>
              <View style={[styles.badgePill, { backgroundColor: colors.surfaceElevated }]}>
                <Text style={[styles.badgeText, { color: colors.textSecondary }]}>
                  {seats.length} {t.seat.toLowerCase()}s
                </Text>
              </View>
            </View>

            <Text style={[styles.sectionHint, { color: colors.textMuted }]}>
              Tap seat for QR / receipt
            </Text>
          </View>

          {/* Responsive Seat Grid */}
          <SeatGrid seats={seats} onSeatPress={handleSeatPress} />

          {/* Demo Sandbox Banner */}
          <View style={[styles.demoBanner, { backgroundColor: colors.surfaceElevated, borderColor: colors.borderSubtle }]}>
            <Sparkles size={16} color={colors.warning} />
            <Text style={[styles.demoBannerText, { color: colors.textSecondary }]}>
              {t.demoModeNotice}
            </Text>
          </View>
        </ScrollView>

        {/* Bottom Floating Action Bar with Primary "Show Payment QR" & Telebirr Badge */}
        <View style={[styles.bottomBar, { backgroundColor: colors.surface, borderTopColor: colors.cardBorder }]}>
          <TouchableOpacity
            style={[styles.primaryQrBtn, { backgroundColor: colors.primaryLime }]}
            onPress={() => setIsUnpaidPickerOpen(true)}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={t.showPaymentQR}
          >
            <View style={styles.btnIconWrap}>
              <QrCode size={22} color={colors.primaryLimeText} strokeWidth={2.4} />
            </View>
            <Text style={[styles.primaryQrBtnText, { color: colors.primaryLimeText }]}>
              {t.showPaymentQR}
            </Text>
          </TouchableOpacity>

          {/* Small Pay with Telebirr Footer */}
          <View style={styles.telebirrFooter}>
            <Text style={[styles.telebirrFooterText, { color: colors.textMuted }]}>
              {t.payWithTelebirr}
            </Text>
            <View style={styles.telebirrLogoBadge}>
              <Text style={styles.telebirrLogoText}>telebirr</Text>
              <View style={styles.miniTag}>
                <Text style={styles.miniTagText}>DEMO</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Modals & Bottom Sheets */}
        <PaymentSheet />
        <ReceiptModal />
        <SeatManagerModal
          visible={isSeatManagerOpen}
          onClose={() => setIsSeatManagerOpen(false)}
        />
        <TripConfigModal
          visible={isTripConfigOpen}
          onClose={() => setIsTripConfigOpen(false)}
        />
        <UnpaidSeatPicker
          visible={isUnpaidPickerOpen}
          onClose={() => setIsUnpaidPickerOpen(false)}
          onSelectSeats={handleSelectSeatsFromPicker}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  mainContainer: {
    flex: 1,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    marginTop: 14,
    marginBottom: 8,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  badgePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  sectionHint: {
    fontSize: 11,
    fontWeight: '500',
  },
  demoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 4,
  },
  demoBannerText: {
    fontSize: 11,
    fontWeight: '500',
    flex: 1,
  },
  bottomBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    borderTopWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 6,
  },
  primaryQrBtn: {
    height: 52,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  btnIconWrap: {
    padding: 2,
  },
  primaryQrBtnText: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  telebirrFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
  },
  telebirrFooterText: {
    fontSize: 12,
    fontWeight: '600',
  },
  telebirrLogoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0F9FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  telebirrLogoText: {
    color: '#0284C7',
    fontSize: 11,
    fontWeight: '800',
  },
  miniTag: {
    backgroundColor: '#FEF08A',
    paddingHorizontal: 3,
    paddingVertical: 1,
    borderRadius: 3,
  },
  miniTagText: {
    color: '#854D0E',
    fontSize: 8,
    fontWeight: '800',
  },
});
