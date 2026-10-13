import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  FlatList,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {
  X,
  ShieldCheck,
  CheckCircle2,
  Ban,
  Loader2,
  UserCheck,
  RefreshCw,
} from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import { useTranslation } from '../localization/useTranslation';
import { AccessStatus, DriverAccess } from '../types';
import {
  fetchAccessAdminList,
  adminApproveAccess,
  adminRevokeAccess,
} from '../services/access/accessService';
import { formatCurrency } from '../utils/formatters';

interface AdminAccessModalProps {
  visible: boolean;
  onClose: () => void;
}

// The PIN is held in component state only. It is never written to AsyncStorage, so
// closing the modal forgets it.
export const AdminAccessModal: React.FC<AdminAccessModalProps> = ({ visible, onClose }) => {
  const { colors } = useTheme();
  const { t, language } = useTranslation();

  const [pin, setPin] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [rows, setRows] = useState<DriverAccess[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [busyPhone, setBusyPhone] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      setPin('');
      setUnlocked(false);
      setRows([]);
    }
  }, [visible]);

  const load = useCallback(
    async (activePin: string) => {
      setIsLoading(true);
      try {
        setRows(await fetchAccessAdminList(activePin));
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Could not load requests.';
        Alert.alert('', message);
        setUnlocked(false);
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const handleUnlock = async () => {
    if (!pin) return;
    setUnlocked(true);
    await load(pin);
  };

  const handleApprove = async (phone: string) => {
    setBusyPhone(phone);
    try {
      await adminApproveAccess(phone, pin);
      await load(pin);
    } catch (e) {
      Alert.alert('', e instanceof Error ? e.message : 'Could not approve.');
    } finally {
      setBusyPhone(null);
    }
  };

  const handleRevoke = async (phone: string) => {
    setBusyPhone(phone);
    try {
      await adminRevokeAccess(phone, pin, 'Revoked by owner');
      await load(pin);
    } catch (e) {
      Alert.alert('', e instanceof Error ? e.message : 'Could not revoke.');
    } finally {
      setBusyPhone(null);
    }
  };

  const statusTone = (status: AccessStatus) => {
    switch (status) {
      case 'approved':
        return { tint: colors.paidText, background: colors.paidBg };
      case 'processing':
      case 'pending':
        return { tint: colors.warning, background: colors.warningLight };
      case 'rejected':
        return { tint: colors.danger, background: colors.dangerLight };
      default:
        return { tint: colors.textMuted, background: colors.unpaidBg };
    }
  };

  const statusLabel = (status: AccessStatus) => {
    switch (status) {
      case 'approved':
        return t.accessStatusApproved;
      case 'processing':
        return t.accessStatusProcessing;
      case 'pending':
        return t.accessStatusPending;
      case 'rejected':
        return t.accessStatusRejected;
      default:
        return t.accessStatusUnpaid;
    }
  };

  const renderRow = ({ item }: { item: DriverAccess }) => {
    const tone = statusTone(item.status);
    const busy = busyPhone === item.phone;

    return (
      <View
        style={[
          styles.row,
          { backgroundColor: colors.surfaceElevated, borderColor: colors.borderSubtle },
        ]}
      >
        <View style={styles.rowHeader}>
          <Text style={[styles.rowPhone, { color: colors.textPrimary }]}>{item.phone}</Text>
          <View style={[styles.badge, { backgroundColor: tone.background }]}>
            <Text style={[styles.badgeText, { color: tone.tint }]}>{statusLabel(item.status)}</Text>
          </View>
        </View>

        <Text style={[styles.rowMeta, { color: colors.textMuted }]}>
          {formatCurrency(item.amount, language)}
          {item.attemptCount > 0 ? ` · ${item.attemptCount}× ${t.accessAttempts}` : ''}
        </Text>

        {item.failureReason ? (
          <Text style={[styles.rowReason, { color: colors.textMuted }]}>
            {t.feeReason}: {item.failureReason}
          </Text>
        ) : null}

        <View style={styles.rowActions}>
          {item.status === 'approved' ? (
            <TouchableOpacity
              style={[styles.actionBtn, { borderColor: colors.danger }]}
              onPress={() => handleRevoke(item.phone)}
              disabled={busy}
              activeOpacity={0.8}
              accessibilityRole="button"
            >
              {busy ? (
                <Loader2 size={14} color={colors.danger} />
              ) : (
                <Ban size={14} color={colors.danger} />
              )}
              <Text style={[styles.actionText, { color: colors.danger }]}>{t.accessRevoke}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.actionBtn, { borderColor: colors.paidText }]}
              onPress={() => handleApprove(item.phone)}
              disabled={busy}
              activeOpacity={0.8}
              accessibilityRole="button"
            >
              {busy ? (
                <Loader2 size={14} color={colors.paidText} />
              ) : (
                <CheckCircle2 size={14} color={colors.paidText} />
              )}
              <Text style={[styles.actionText, { color: colors.paidText }]}>
                {t.accessApprove}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={[styles.backdrop, { backgroundColor: colors.modalOverlay }]}>
        <View
          style={[
            styles.sheet,
            { backgroundColor: colors.surface, borderColor: colors.cardBorder },
          ]}
        >
          <View style={[styles.header, { borderBottomColor: colors.cardBorder }]}>
            <View style={styles.headerTitle}>
              <ShieldCheck size={18} color={colors.primaryForest} />
              <Text style={[styles.title, { color: colors.textPrimary }]}>
                {t.accessAdminTitle}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={t.close}
            >
              <X size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {!unlocked ? (
            <View style={styles.pinWrap}>
              <Text style={[styles.pinHint, { color: colors.textMuted }]}>{t.accessAdminPinHint}</Text>
              <TextInput
                style={[
                  styles.pinInput,
                  {
                    backgroundColor: colors.surfaceElevated,
                    color: colors.textPrimary,
                    borderColor: colors.borderSubtle,
                  },
                ]}
                value={pin}
                onChangeText={setPin}
                placeholder="••••"
                placeholderTextColor={colors.textMuted}
                secureTextEntry
                keyboardType="number-pad"
                maxLength={12}
              />
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: colors.primaryLime }]}
                onPress={handleUnlock}
                disabled={!pin || isLoading}
                activeOpacity={0.85}
                accessibilityRole="button"
              >
                {isLoading ? (
                  <ActivityIndicator color={colors.primaryLimeText} />
                ) : (
                  <UserCheck size={18} color={colors.primaryLimeText} />
                )}
                <Text style={[styles.primaryBtnText, { color: colors.primaryLimeText }]}>
                  {t.accessAdminSignIn}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <FlatList
                data={rows}
                keyExtractor={(item) => item.phone}
                renderItem={renderRow}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={
                  isLoading ? (
                    <ActivityIndicator color={colors.primaryLime} style={styles.emptyLoader} />
                  ) : (
                    <Text style={[styles.empty, { color: colors.textMuted }]}>
                      {t.accessAdminEmpty}
                    </Text>
                  )
                }
              />

              <TouchableOpacity
                style={[styles.refreshBtn, { borderColor: colors.borderSubtle }]}
                onPress={() => load(pin)}
                disabled={isLoading}
                activeOpacity={0.8}
                accessibilityRole="button"
              >
                <RefreshCw size={14} color={colors.textSecondary} />
                <Text style={[styles.refreshText, { color: colors.textSecondary }]}>
                  {t.accessAdminRefresh}
                </Text>
              </TouchableOpacity>
            </>
          )}
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
  sheet: {
    maxHeight: '86%',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    paddingBottom: 28,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
  },
  pinWrap: {
    padding: 20,
  },
  pinHint: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 10,
  },
  pinInput: {
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 4,
    marginBottom: 12,
  },
  primaryBtn: {
    height: 48,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: '800',
  },
  listContent: {
    padding: 16,
    gap: 10,
    flexGrow: 1,
  },
  row: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  rowPhone: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  rowMeta: {
    fontSize: 11,
    marginTop: 4,
  },
  rowReason: {
    fontSize: 10,
    marginTop: 2,
  },
  rowActions: {
    flexDirection: 'row',
    marginTop: 10,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 9,
    borderWidth: 1,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '800',
  },
  empty: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 24,
  },
  emptyLoader: {
    marginTop: 24,
  },
  refreshBtn: {
    height: 42,
    marginHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  refreshText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
