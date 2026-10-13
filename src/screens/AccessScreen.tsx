import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Car,
  Wallet,
  Sun,
  Moon,
  Globe,
  ShieldAlert,
  Loader2,
  Lock,
  CheckCircle2,
  KeyRound,
} from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import { useTranslation } from '../localization/useTranslation';
import { useAccess } from '../state/AccessContext';
import { AccessStatus } from '../types';
import { formatCurrency } from '../utils/formatters';

interface AccessScreenProps {
  onOpenAdmin: () => void;
}

interface StatusStyle {
  icon: React.ComponentType<{ size?: number; color?: string }>;
  tint: string;
  background: string;
  labelKey:
    | 'accessStatusUnpaid'
    | 'accessStatusPending'
    | 'accessStatusProcessing'
    | 'accessStatusApproved'
    | 'accessStatusRejected';
}

function statusStyle(
  colors: ReturnType<typeof useTheme>['colors'],
  status: AccessStatus,
): StatusStyle {
  switch (status) {
    case 'approved':
      return {
        icon: CheckCircle2,
        tint: colors.paidText,
        background: colors.paidBg,
        labelKey: 'accessStatusApproved',
      };
    case 'processing':
      return {
        icon: Loader2,
        tint: colors.warning,
        background: colors.warningLight,
        labelKey: 'accessStatusProcessing',
      };
    case 'rejected':
      return {
        icon: ShieldAlert,
        tint: colors.danger,
        background: colors.dangerLight,
        labelKey: 'accessStatusRejected',
      };
    case 'pending':
      return {
        icon: Loader2,
        tint: colors.warning,
        background: colors.warningLight,
        labelKey: 'accessStatusPending',
      };
    default:
      return {
        icon: Lock,
        tint: colors.textMuted,
        background: colors.unpaidBg,
        labelKey: 'accessStatusUnpaid',
      };
  }
}

export const AccessScreen: React.FC<AccessScreenProps> = ({ onOpenAdmin }) => {
  const { colors, mode, toggleTheme } = useTheme();
  const { t, language, toggleLanguage } = useTranslation();
  const {
    driverPhone,
    setDriverPhone,
    access,
    isLoading,
    isPaying,
    isVerifying,
    payAccessFee,
    verifyAccessPayment,
    refreshAccess,
  } = useAccess();

  const [phoneDraft, setPhoneDraft] = useState(driverPhone);

  useEffect(() => {
    setPhoneDraft(driverPhone);
  }, [driverPhone]);

  const phoneValid = /^09\d{8}$/.test(phoneDraft.trim());
  const status = access ? access.status : 'unpaid';
  const style = statusStyle(colors, status);
  const StatusIcon = style.icon;
  const amount = access?.amount ?? 0;
  const awaitingGateway = status === 'pending' || status === 'processing';

  const handlePhoneChange = (value: string) => {
    const cleaned = value.replace(/[^0-9]/g, '').slice(0, 10);
    setPhoneDraft(cleaned);
    setDriverPhone(cleaned);
  };

  const handlePay = async () => {
    const result = await payAccessFee();
    if (result.message) Alert.alert('', result.message);
  };

  const handleCheck = async () => {
    const result = await verifyAccessPayment();
    if (result.message) Alert.alert('', result.message);
  };

  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primaryLime} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.headerBackground }]}>
      <StatusBar barStyle="light-content" backgroundColor={colors.headerBackground} />

      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.headerBackground }]}>
          <View style={styles.headerTop}>
            <View style={styles.brandRow}>
              <View style={[styles.logoWrapper, { backgroundColor: colors.primaryLime }]}>
                <Car size={22} color={colors.primaryLimeText} strokeWidth={2.5} />
              </View>
              <View>
                <Text style={[styles.brandTitle, { color: colors.headerText }]}>{t.appName}</Text>
                <Text style={[styles.brandSubtitle, { color: colors.headerSubtext }]}>
                  {t.accessLockedSubtitle}
                </Text>
              </View>
            </View>

            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={[styles.iconButton, { backgroundColor: 'rgba(255,255,255,0.12)' }]}
                onPress={toggleLanguage}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`Switch language. Current: ${language.toUpperCase()}`}
              >
                <Globe size={17} color="#FFFFFF" />
                <Text style={styles.langText}>{language === 'en' ? 'አማ' : 'EN'}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.iconButton, { backgroundColor: 'rgba(255,255,255,0.12)' }]}
                onPress={toggleTheme}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`Switch to ${mode === 'light' ? 'dark' : 'light'} mode`}
              >
                {mode === 'light' ? (
                  <Moon size={17} color="#FFFFFF" />
                ) : (
                  <Sun size={17} color="#FFFFFF" />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Activation fee */}
          <View
            style={[
              styles.feeCard,
              { backgroundColor: colors.surfaceElevated, borderColor: colors.borderSubtle },
            ]}
          >
            <View style={styles.feeHeader}>
              <Wallet size={16} color={colors.primaryForest} />
              <Text style={[styles.feeTitle, { color: colors.textPrimary }]}>{t.accessFeeTitle}</Text>
              <Text style={[styles.feeAmount, { color: colors.primaryForest }]}>
                {formatCurrency(amount || 5, language)}
              </Text>
            </View>

            <Text style={[styles.explain, { color: colors.textMuted }]}>
              {t.accessFeeExplain.replace('{amount}', String(amount || 5))}
            </Text>
            <Text style={[styles.explain, { color: colors.textMuted }]}>
              {t.accessFeeMandateNote}
            </Text>
            {access?.payeePhone ? (
              <Text style={[styles.payee, { color: colors.textSecondary }]}>
                {t.accessPayee}: {access.payeePhone}
              </Text>
            ) : null}
          </View>

          {/* Driver number */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              {t.driverPhoneLabel}
            </Text>
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
              onChangeText={handlePhoneChange}
              onBlur={() => {
                if (phoneValid) refreshAccess();
              }}
              placeholder={t.driverPhoneHint}
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              maxLength={10}
            />
          </View>

          {/* Status */}
          <View style={[styles.statusCard, { backgroundColor: style.background, borderColor: style.tint }]}>
            <StatusIcon size={18} color={style.tint} />
            <View style={styles.statusInfo}>
              <Text style={[styles.statusLabel, { color: style.tint }]}>{t[style.labelKey]}</Text>
              {access?.failureReason ? (
                <Text style={[styles.statusReason, { color: colors.textMuted }]}>
                  {t.feeReason}: {access.failureReason}
                </Text>
              ) : null}
            </View>
          </View>

          {!access?.telebirrConfigured && phoneValid ? (
            <View
              style={[
                styles.notice,
                { backgroundColor: colors.dangerLight, borderColor: colors.danger },
              ]}
            >
              <ShieldAlert size={16} color={colors.danger} />
              <Text style={[styles.noticeText, { color: colors.danger }]}>
                {t.accessNotConfigured}
              </Text>
            </View>
          ) : null}

          {awaitingGateway ? (
            <TouchableOpacity
              style={[styles.secondaryBtn, { borderColor: colors.borderSubtle }]}
              onPress={handleCheck}
              disabled={isVerifying}
              activeOpacity={0.8}
              accessibilityRole="button"
            >
              {isVerifying ? (
                <Loader2 size={18} color={colors.textMuted} />
              ) : (
                <CheckCircle2 size={18} color={colors.textPrimary} />
              )}
              <Text style={[styles.secondaryBtnText, { color: colors.textPrimary }]}>
                {isVerifying ? t.accessChecking : t.accessCheckStatus}
              </Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            style={[
              styles.payBtn,
              {
                backgroundColor:
                  phoneValid && !isPaying ? colors.primaryLime : colors.surfaceElevated,
              },
            ]}
            onPress={handlePay}
            disabled={isPaying || !phoneValid}
            activeOpacity={0.85}
            accessibilityRole="button"
          >
            {isPaying ? (
              <Loader2 size={18} color={colors.textMuted} />
            ) : (
              <Lock size={18} color={phoneValid ? colors.primaryLimeText : colors.textMuted} />
            )}
            <Text
              style={[
                styles.payBtnText,
                { color: phoneValid ? colors.primaryLimeText : colors.textMuted },
              ]}
            >
              {isPaying ? t.accessPaying : awaitingGateway ? t.accessPayAgain : t.accessPayButton}
            </Text>
          </TouchableOpacity>

          <Text style={[styles.lockNote, { color: colors.textMuted }]}>{t.accessLockedNote}</Text>

          {/* Owner entry point */}
          <TouchableOpacity
            style={styles.ownerBtn}
            onPress={onOpenAdmin}
            activeOpacity={0.7}
            accessibilityRole="button"
          >
            <KeyRound size={14} color={colors.textMuted} />
            <Text style={[styles.ownerText, { color: colors.textMuted }]}>{t.accessOwnerSignIn}</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 1,
  },
  logoWrapper: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  brandSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 1,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    height: 40,
    minWidth: 40,
    paddingHorizontal: 8,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  langText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 32 : 20,
  },
  feeCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  feeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  feeTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
  },
  feeAmount: {
    fontSize: 16,
    fontWeight: '900',
  },
  explain: {
    fontSize: 11,
    lineHeight: 16,
  },
  payee: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 6,
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
  statusReason: {
    fontSize: 10,
    marginTop: 2,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  noticeText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '600',
  },
  secondaryBtn: {
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: '800',
  },
  payBtn: {
    height: 52,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  payBtnText: {
    fontSize: 15,
    fontWeight: '800',
  },
  lockNote: {
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
    marginTop: 14,
  },
  ownerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 18,
  },
  ownerText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
