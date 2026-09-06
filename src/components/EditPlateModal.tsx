import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { X, Check, Car } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import { useTranslation } from '../localization/useTranslation';
import { useTaxi } from '../state/TaxiContext';
import { formatPlate } from '../utils/formatters';

interface EditPlateModalProps {
  visible: boolean;
  onClose: () => void;
}

export const EditPlateModal: React.FC<EditPlateModalProps> = ({ visible, onClose }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { trip, updatePlateNumber } = useTaxi();

  const [plateInput, setPlateInput] = useState(trip.plateNumber);

  useEffect(() => {
    if (visible) {
      setPlateInput(trip.plateNumber);
    }
  }, [visible, trip.plateNumber]);

  const handleSave = () => {
    if (plateInput.trim().length > 0) {
      updatePlateNumber(plateInput);
    }
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={[styles.backdrop, { backgroundColor: colors.modalOverlay }]}>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <View style={[styles.iconWrap, { backgroundColor: colors.surfaceElevated }]}>
                <Car size={20} color={colors.primaryForest} />
              </View>
              <View>
                <Text style={[styles.title, { color: colors.textPrimary }]}>
                  {t.plateInputLabel}
                </Text>
                <Text style={[styles.sub, { color: colors.textMuted }]}>
                  Edit vehicle plate / car number
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <X size={20} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Input Box */}
          <View style={styles.inputContainer}>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.surfaceElevated,
                  color: colors.textPrimary,
                  borderColor: colors.borderSubtle,
                },
              ]}
              value={plateInput}
              onChangeText={setPlateInput}
              placeholder="e.g. 3-B76212 AA"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="characters"
              autoFocus={true}
            />
          </View>

          {/* Quick Presets */}
          <View style={styles.presetsRow}>
            {['3-B76212 AA', '2-A90412 AA', '3-C14589 AA'].map(preset => (
              <TouchableOpacity
                key={preset}
                style={[styles.presetBadge, { backgroundColor: colors.surfaceElevated, borderColor: colors.borderSubtle }]}
                onPress={() => setPlateInput(preset)}
                activeOpacity={0.7}
              >
                <Text style={[styles.presetText, { color: colors.textSecondary }]}>
                  {preset}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Action Buttons */}
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.cancelBtn, { backgroundColor: colors.surfaceElevated }]}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text style={[styles.cancelBtnText, { color: colors.textSecondary }]}>
                {t.cancelAction}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: colors.primaryLime }]}
              onPress={handleSave}
              activeOpacity={0.8}
            >
              <Check size={18} color={colors.primaryLimeText} strokeWidth={2.5} />
              <Text style={[styles.saveBtnText, { color: colors.primaryLimeText }]}>
                {t.saveTripSettings}
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
  card: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
  },
  sub: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  inputContainer: {
    marginBottom: 12,
  },
  input: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 1,
  },
  presetsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  presetBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  presetText: {
    fontSize: 11,
    fontWeight: '700',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  saveBtn: {
    flex: 1.5,
    height: 48,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '800',
  },
});
