import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Switch,
} from 'react-native';
import { X, Navigation, AlertTriangle, ShieldCheck, Check, RotateCcw, Car } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import { useTranslation } from '../localization/useTranslation';
import { useTaxi } from '../state/TaxiContext';

interface TripConfigModalProps {
  visible: boolean;
  onClose: () => void;
}

export const TripConfigModal: React.FC<TripConfigModalProps> = ({ visible, onClose }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { trip, updateTripDetails, startNewTrip, unresolvedCount } = useTaxi();

  const [routeName, setRouteName] = useState(trip.routeName);
  const [farePerSeat, setFarePerSeat] = useState(trip.farePerSeat.toString());
  const [plateNumber, setPlateNumber] = useState(trip.plateNumber);
  const [resetSeatsOnSave, setResetSeatsOnSave] = useState(true);
  const [isConfirmingNewTrip, setIsConfirmingNewTrip] = useState(false);

  useEffect(() => {
    if (visible) {
      setRouteName(trip.routeName);
      setFarePerSeat(trip.farePerSeat.toString());
      setPlateNumber(trip.plateNumber);
      setIsConfirmingNewTrip(false);
    }
  }, [visible, trip]);

  const handleSaveSettings = () => {
    const parsedFare = parseFloat(farePerSeat) || trip.farePerSeat;
    // Resets seats when saving settings as requested by user
    updateTripDetails(routeName, parsedFare, plateNumber, resetSeatsOnSave);
    onClose();
  };

  const handleStartNewTrip = () => {
    const parsedFare = parseFloat(farePerSeat) || trip.farePerSeat;
    startNewTrip(routeName, parsedFare, plateNumber);
    setIsConfirmingNewTrip(false);
    onClose();
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
            <View>
              <Text style={[styles.title, { color: colors.textPrimary }]}>
                {t.configureTrip}
              </Text>
              <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                Trip ID: {trip.id}
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

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Input 1: Vehicle Plate / Car Number */}
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Car size={14} color={colors.primaryForest} />
                <Text style={[styles.label, { color: colors.textSecondary }]}>
                  {t.plateInputLabel} (Car Number)
                </Text>
              </View>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.surfaceElevated,
                    color: colors.textPrimary,
                    borderColor: colors.borderSubtle,
                    fontWeight: '800',
                    letterSpacing: 0.5,
                  },
                ]}
                value={plateNumber}
                onChangeText={setPlateNumber}
                placeholder="3-B76212 AA"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="characters"
              />
            </View>

            {/* Input 2: Route Name */}
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Navigation size={14} color={colors.primaryForest} />
                <Text style={[styles.label, { color: colors.textSecondary }]}>
                  {t.routeInputLabel}
                </Text>
              </View>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.surfaceElevated,
                    color: colors.textPrimary,
                    borderColor: colors.borderSubtle,
                  },
                ]}
                value={routeName}
                onChangeText={setRouteName}
                placeholder="e.g. Bole → Megenagna"
                placeholderTextColor={colors.textMuted}
              />
            </View>

            {/* Input 3: Fare per seat */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                {t.fareInputLabel}
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.surfaceElevated,
                    color: colors.textPrimary,
                    borderColor: colors.borderSubtle,
                  },
                ]}
                value={farePerSeat}
                onChangeText={setFarePerSeat}
                keyboardType="numeric"
                placeholder="40"
                placeholderTextColor={colors.textMuted}
              />
            </View>

            {/* Option: Reset seats on save */}
            <View style={[styles.switchCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.borderSubtle }]}>
              <View style={styles.switchInfo}>
                <Text style={[styles.switchTitle, { color: colors.textPrimary }]}>
                  Reset all seats to Unpaid
                </Text>
                <Text style={[styles.switchSub, { color: colors.textMuted }]}>
                  Clears previous fares and resets seats for this trip
                </Text>
              </View>
              <Switch
                value={resetSeatsOnSave}
                onValueChange={setResetSeatsOnSave}
                trackColor={{ false: colors.borderSubtle, true: colors.primaryLime }}
                thumbColor="#FFFFFF"
              />
            </View>

            {/* Save Trip Settings Button */}
            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: colors.primaryLime }]}
              onPress={handleSaveSettings}
              activeOpacity={0.8}
            >
              <Check size={18} color={colors.primaryLimeText} strokeWidth={2.5} />
              <Text style={[styles.saveBtnText, { color: colors.primaryLimeText }]}>
                {t.saveTripSettings} & Reset Seats
              </Text>
            </TouchableOpacity>

            {/* Divider */}
            <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />

            {/* Start New Trip Section */}
            <View style={styles.newTripSection}>
              <Text style={[styles.sectionHeading, { color: colors.textPrimary }]}>
                {t.newTrip}
              </Text>
              <Text style={[styles.sectionDesc, { color: colors.textMuted }]}>
                {t.newTripConfirmMsg}
              </Text>

              {/* Unresolved warning */}
              {unresolvedCount > 0 && (
                <View style={[styles.warningBox, { backgroundColor: colors.warningLight, borderColor: colors.warning }]}>
                  <AlertTriangle size={18} color={colors.warning} />
                  <Text style={[styles.warningText, { color: colors.textPrimary }]}>
                    {t.unresolvedWarning.replace('{count}', unresolvedCount.toString())}
                  </Text>
                </View>
              )}

              {isConfirmingNewTrip ? (
                <View style={styles.confirmRow}>
                  <TouchableOpacity
                    style={[styles.confirmCancelBtn, { backgroundColor: colors.surfaceElevated }]}
                    onPress={() => setIsConfirmingNewTrip(false)}
                  >
                    <Text style={[styles.confirmCancelBtnText, { color: colors.textSecondary }]}>
                      {t.cancelAction}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.confirmStartBtn, { backgroundColor: colors.primaryLime }]}
                    onPress={handleStartNewTrip}
                  >
                    <RotateCcw size={16} color={colors.primaryLimeText} />
                    <Text style={[styles.confirmStartBtnText, { color: colors.primaryLimeText }]}>
                      {t.startTrip}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.startNewTripBtn, { backgroundColor: colors.surfaceElevated, borderColor: colors.borderSubtle }]}
                  onPress={() => setIsConfirmingNewTrip(true)}
                  activeOpacity={0.8}
                >
                  <RotateCcw size={18} color={colors.primaryForest} />
                  <Text style={[styles.startNewTripBtnText, { color: colors.primaryForest }]}>
                    {t.newTrip}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>
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
    maxHeight: '90%',
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
  inputGroup: {
    marginBottom: 14,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
  },
  input: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 15,
    fontWeight: '600',
  },
  switchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 14,
  },
  switchInfo: {
    flex: 1,
    marginRight: 10,
  },
  switchTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  switchSub: {
    fontSize: 11,
    marginTop: 2,
  },
  saveBtn: {
    height: 50,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 6,
    marginBottom: 14,
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '800',
  },
  divider: {
    height: 1,
    marginVertical: 14,
  },
  newTripSection: {
    marginBottom: 20,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  sectionDesc: {
    fontSize: 12,
    marginBottom: 12,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
  },
  warningText: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  confirmRow: {
    flexDirection: 'row',
    gap: 10,
  },
  confirmCancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmCancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  confirmStartBtn: {
    flex: 1.2,
    height: 48,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  confirmStartBtnText: {
    fontSize: 13,
    fontWeight: '800',
  },
  startNewTripBtn: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  startNewTripBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
