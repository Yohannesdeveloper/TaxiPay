import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert } from 'react-native';
import { Wallet, CheckCircle2, Clock, AlertCircle, Loader2, Flag } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import { useTranslation } from '../localization/useTranslation';
import { useTaxi } from '../state/TaxiContext';
import { Settlement } from '../types';
import { formatCurrency } from '../utils/formatters';

const PAYEE_NUMBER = '0942927999';

interface StatusStyle {
  icon: React.ComponentType<{ size?: number; color?: string }>;
  tint: string;
  background: string;
  labelKey: 'feeStatusPending' | 'feeStatusProcessing' | 'feeStatusSucceeded' | 'feeStatusFailed';
}

function statusStyle(colors: ReturnType<typeof useTheme>['colors'], status: Settlement['status']): StatusStyle {
  switch (status) {
    case 'succeeded':
      return {
        icon: CheckCircle2,
        tint: colors.paidText,
        background: colors.paidBg,
        labelKey: 'feeStatusSucceeded',
      };
    case 'processing':
      return {
        icon: Clock,
        tint: colors.warning,
        background: colors.warningLight,
        labelKey: 'feeStatusProcessing',
      };
    case 'failed':
      return {
        icon: AlertCircle,
        tint: colors.danger,
        background: colors.dangerLight,
        labelKey: 'feeStatusFailed',
      };
    default:
      return {
        icon: Clock,
        tint: colors.textMuted,
        background: colors.unpaidBg,
        labelKey: 'feeStatusPending',
      };
  }
}

export const SettlementPanel: React.FC = () => {
  const { colors } = useTheme();
  const { t, language } = useTranslation();
  const {
    trip,
    feePerTrip,
    driverPhone,
    setDriverPhone,
    currentSettlement,
    isCompletingTrip,
    completeTrip,
    retrySettlement,
    refreshSettlements,
  } = useTaxi();

  const [phoneDraft, setPhoneDraft] = useState(driverPhone);

  useEffect(() => {
    setPhoneDraft(driverPhone);
  }, [driverPhone]);

  useEffect(() => {
    refreshSettlements();
  }, [refreshSettlements]);

  const phoneValid = /^09\d{8}$/.test(phoneDraft.trim());
  const ended = trip.isCompleted;
  const status = currentSettlement ? statusStyle(colors, currentSettlement.status) : null;
  const StatusIcon = status?.icon ?? Clock;

  const handleEndTrip = () => {
    Alert.alert(
      t.endTrip,
      `${t.tripFeeExplain.replace('{amount}', String(feePerTrip)).replace('{number}', PAYEE_NUMBER)}\n\n${t.tripFeeMandateNote}`,
      [
        { text: t.cancelAction, style: 'cancel' },
        {
          text: t.endTrip,
          onPress: async () => {
            const result = await completeTrip();
            Alert.alert('', result.message);
          },
        },
      ],
    );
  };

  const handleRetry = async () => {
    if (!currentSettlement) return;
    const result = await retrySettlement(currentSettlement.id);
    Alert.alert('', result.message);
  };

  return (
    <View style={styles.wrapper}>
      {/* Fee explanation */}
      <View style={[styles.card, { backgroundColor: colors.surfaceElevated, borderColor: colors.borderSubtle }]}>
        <View style={styles.headerRow}>
          <Wallet size={16} color={colors.primaryForest} />
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{t.tripFee}</Text>
          <Text style={[styles.amount, { color: colors.primaryForest }]}>
            {formatCurrency(feePerTrip, language)}
          </Text>
        </View>

        <Text style={[styles.explain, { color: colors.textMuted }]}>
          {t.tripFeeExplain.replace('{amount}', String(feePerTrip)).replace('{number}', PAYEE_NUMBER)}
        </Text>
        <Text style={[styles.explain, { color: colors.textMuted }]}>{t.tripFeeMandateNote}</Text>
      </View>

      {/* Driver phone */}
      <View style={styles.inputGroup}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>{t.driverPhoneLabel}</Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: colors.surfaceElevated,
              color: colors.textPrimary,
              borderColor: phoneDraft && !phoneValid ? colors.danger : colors.borderSubtle,
            },
          ]}
          value={phoneDraft}
          onChangeText={(value) => {
            setPhoneDraft(value);
            setDriverPhone(value);
          }}
          placeholder={t.driverPhoneHint}
          placeholderTextColor={colors.textMuted}
          keyboardType="number-pad"
          maxLength={10}
          editable={!ended}
        />
      </View>

      {/* Current trip fee status */}
      {currentSettlement && status ? (
        <View style={[styles.statusCard, { backgroundColor: status.background, borderColor: status.tint }]}>
          <StatusIcon size={18} color={status.tint} />
          <View style={styles.statusInfo}>
            <Text style={[styles.statusLabel, { color: status.tint }]}>{t[status.labelKey]}</Text>
            <Text style={[styles.statusAmount, { color: colors.textPrimary }]}>
              {formatCurrency(currentSettlement.amount, language)} → {currentSettlement.payeePhone}
            </Text>
            {currentSettlement.failureReason ? (
              <Text style={[styles.statusReason, { color: colors.textMuted }]}>
                {t.feeReason}: {currentSettlement.failureReason}
              </Text>
            ) : null}
          </View>

          {currentSettlement.status === 'failed' || currentSettlement.status === 'pending' ? (
            <TouchableOpacity
              onPress={handleRetry}
              style={[styles.retryBtn, { borderColor: status.tint }]}
              accessibilityRole="button"
            >
              <Text style={[styles.retryText, { color: status.tint }]}>{t.retryFee}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : (
        <Text style={[styles.noRecord, { color: colors.textMuted }]}>{t.noFeeRecord}</Text>
      )}

      {/* End trip */}
      {ended ? (
        <View style={[styles.endedRow, { backgroundColor: colors.paidBg, borderColor: colors.paidBorder }]}>
          <Flag size={16} color={colors.paidText} />
          <Text style={[styles.endedText, { color: colors.paidText }]}>
            {t.tripEnded}
            {trip.endTime ? ` · ${trip.endTime}` : ''}
          </Text>
        </View>
      ) : (
        <TouchableOpacity
          style={[
            styles.endBtn,
            {
              backgroundColor: phoneValid ? colors.primaryLime : colors.surfaceElevated,
              borderColor: colors.borderSubtle,
            },
          ]}
          onPress={handleEndTrip}
          disabled={isCompletingTrip || !phoneValid}
          activeOpacity={0.8}
          accessibilityRole="button"
        >
          {isCompletingTrip ? (
            <Loader2 size={18} color={colors.textMuted} />
          ) : (
            <Flag size={18} color={phoneValid ? colors.primaryLimeText : colors.textMuted} />
          )}
          <Text
            style={[
              styles.endBtnText,
              { color: phoneValid ? colors.primaryLimeText : colors.textMuted },
            ]}
          >
            {isCompletingTrip ? t.endingTrip : t.endTrip}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 18,
  },
  card: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  cardTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
  },
  amount: {
    fontSize: 16,
    fontWeight: '900',
  },
  explain: {
    fontSize: 11,
    lineHeight: 16,
  },
  inputGroup: {
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  input: {
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  statusInfo: {
    flex: 1,
  },
  statusLabel: {
    fontSize: 12,
    fontWeight: '800',
  },
  statusAmount: {
    fontSize: 11,
    marginTop: 2,
  },
  statusReason: {
    fontSize: 10,
    marginTop: 2,
  },
  retryBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  retryText: {
    fontSize: 11,
    fontWeight: '800',
  },
  noRecord: {
    fontSize: 11,
    marginBottom: 12,
  },
  endedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  endedText: {
    fontSize: 13,
    fontWeight: '800',
  },
  endBtn: {
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  endBtnText: {
    fontSize: 15,
    fontWeight: '800',
  },
});
