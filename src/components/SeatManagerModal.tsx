import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import {
  X,
  Plus,
  Trash2,
  Armchair,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Circle,
  Edit2,
  RotateCcw,
  Sparkles,
  Check,
} from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import { useTranslation } from '../localization/useTranslation';
import { useTaxi } from '../state/TaxiContext';
import { Seat, SeatStatus } from '../types';

interface SeatManagerModalProps {
  visible: boolean;
  onClose: () => void;
}

export const SeatManagerModal: React.FC<SeatManagerModalProps> = ({ visible, onClose }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const {
    seats,
    addSeat,
    editSeat,
    updateSeatStatus,
    removeSeat,
    canRemoveSeat,
    resetSeatsToUnpaid,
    clearDummyData,
  } = useTaxi();

  const [selectedSeatToRemove, setSelectedSeatToRemove] = useState<Seat | null>(null);
  const [editingSeat, setEditingSeat] = useState<Seat | null>(null);
  const [editNumber, setEditNumber] = useState<string>('');
  const [editLabel, setEditLabel] = useState<string>('');
  const [editStatus, setEditStatus] = useState<SeatStatus>('unpaid');

  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [isConfirming, setIsConfirming] = useState<boolean>(false);

  // Add seat
  const handleAdd = () => {
    setWarningMessage(null);
    const success = addSeat();
    if (!success) {
      setWarningMessage(t.capacityLimitReached);
    }
  };

  // Open Edit Mode
  const handleStartEdit = (seat: Seat) => {
    setEditingSeat(seat);
    setEditNumber(seat.seatNumber.toString());
    setEditLabel(seat.label || `Seat ${seat.seatNumber}`);
    setEditStatus(seat.status);
    setSelectedSeatToRemove(null);
    setIsConfirming(false);
  };

  const handleSaveEdit = () => {
    if (!editingSeat) return;
    const parsedNum = parseInt(editNumber, 10) || editingSeat.seatNumber;
    editSeat(editingSeat.id, {
      seatNumber: parsedNum,
      label: editLabel.trim(),
      status: editStatus,
    });
    setEditingSeat(null);
  };

  const handleCancelEdit = () => {
    setEditingSeat(null);
  };

  // Quick toggle status for seat
  const handleCycleStatus = (seat: Seat) => {
    let nextStatus: SeatStatus = 'unpaid';
    if (seat.status === 'unpaid') nextStatus = 'pending';
    else if (seat.status === 'pending') nextStatus = 'paid';
    else if (seat.status === 'paid') nextStatus = 'unpaid';

    updateSeatStatus(seat.seatNumber, nextStatus);
  };

  const handleSelectSeatToRemove = (seat: Seat) => {
    const check = canRemoveSeat(seat.seatNumber);
    if (!check.canRemove) {
      if (check.reason === 'activePayment') {
        setWarningMessage(t.cannotRemovePaidOrPending.replace('{num}', seat.seatNumber.toString()));
      } else if (check.reason === 'minCapacity') {
        setWarningMessage(t.minCapacityReached);
      }
      setSelectedSeatToRemove(null);
      setIsConfirming(false);
      return;
    }

    setWarningMessage(null);
    setSelectedSeatToRemove(seat);
    setIsConfirming(true);
    setEditingSeat(null);
  };

  const handleConfirmRemoval = () => {
    if (!selectedSeatToRemove) return;

    const res = removeSeat(selectedSeatToRemove.seatNumber, true);
    if (res.success) {
      setSelectedSeatToRemove(null);
      setIsConfirming(false);
      setWarningMessage(null);
    } else {
      setWarningMessage(t.cannotRemovePaidOrPending.replace('{num}', selectedSeatToRemove.seatNumber.toString()));
    }
  };

  const handleCancelRemoval = () => {
    setSelectedSeatToRemove(null);
    setIsConfirming(false);
    setWarningMessage(null);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={[styles.backdrop, { backgroundColor: colors.modalOverlay }]}>
        <View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={[styles.title, { color: colors.textPrimary }]}>
                {t.seatManagerTitle}
              </Text>
              <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                Add, edit, delete & update seat tables
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

          {/* Quick Actions Bar */}
          <View style={styles.quickActionsBar}>
            {/* Add Seat */}
            <TouchableOpacity
              style={[styles.primaryAddBtn, { backgroundColor: colors.primaryLime }]}
              onPress={handleAdd}
              activeOpacity={0.8}
            >
              <Plus size={16} color={colors.primaryLimeText} strokeWidth={2.5} />
              <Text style={[styles.primaryAddBtnText, { color: colors.primaryLimeText }]}>
                {t.addSeat}
              </Text>
            </TouchableOpacity>

            {/* Clear Dummy Data & Start Fresh */}
            <TouchableOpacity
              style={[styles.quickSecondaryBtn, { backgroundColor: colors.surfaceElevated, borderColor: colors.borderSubtle }]}
              onPress={() => clearDummyData(12)}
              activeOpacity={0.8}
            >
              <RotateCcw size={14} color={colors.textPrimary} />
              <Text style={[styles.quickSecondaryBtnText, { color: colors.textPrimary }]}>
                Reset All (Clean)
              </Text>
            </TouchableOpacity>
          </View>

          {/* Warning Banner */}
          {warningMessage && (
            <View style={[styles.warningBox, { backgroundColor: colors.warningLight, borderColor: colors.warning }]}>
              <AlertTriangle size={18} color={colors.warning} />
              <Text style={[styles.warningText, { color: colors.textPrimary }]}>
                {warningMessage}
              </Text>
            </View>
          )}

          {/* Edit Seat Card Modal/Section */}
          {editingSeat && (
            <View style={[styles.editBox, { backgroundColor: colors.surfaceElevated, borderColor: colors.primaryLime }]}>
              <View style={styles.editBoxHeader}>
                <Text style={[styles.editBoxTitle, { color: colors.textPrimary }]}>
                  Edit Seat #{editingSeat.seatNumber}
                </Text>
                <TouchableOpacity onPress={handleCancelEdit}>
                  <X size={18} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              <View style={styles.editInputsRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.editInputLabel, { color: colors.textMuted }]}>Number</Text>
                  <TextInput
                    style={[styles.editInput, { backgroundColor: colors.surface, color: colors.textPrimary, borderColor: colors.borderSubtle }]}
                    value={editNumber}
                    onChangeText={setEditNumber}
                    keyboardType="numeric"
                  />
                </View>
                <View style={{ flex: 2 }}>
                  <Text style={[styles.editInputLabel, { color: colors.textMuted }]}>Label / Name</Text>
                  <TextInput
                    style={[styles.editInput, { backgroundColor: colors.surface, color: colors.textPrimary, borderColor: colors.borderSubtle }]}
                    value={editLabel}
                    onChangeText={setEditLabel}
                    placeholder="e.g. Front Right"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
              </View>

              {/* Status Picker for this seat */}
              <View style={styles.statusPickerRow}>
                {(['unpaid', 'pending', 'paid'] as SeatStatus[]).map(st => (
                  <TouchableOpacity
                    key={st}
                    style={[
                      styles.statusChip,
                      {
                        backgroundColor: editStatus === st ? colors.primaryForest : colors.surface,
                        borderColor: colors.borderSubtle,
                      },
                    ]}
                    onPress={() => setEditStatus(st)}
                  >
                    <Text
                      style={[
                        styles.statusChipText,
                        { color: editStatus === st ? '#FFFFFF' : colors.textSecondary },
                      ]}
                    >
                      {st.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.editActionsRow}>
                <TouchableOpacity
                  style={[styles.editCancelBtn, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}
                  onPress={handleCancelEdit}
                >
                  <Text style={[styles.editCancelBtnText, { color: colors.textSecondary }]}>
                    {t.cancelAction}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.editSaveBtn, { backgroundColor: colors.primaryLime }]}
                  onPress={handleSaveEdit}
                >
                  <Check size={16} color={colors.primaryLimeText} strokeWidth={2.5} />
                  <Text style={[styles.editSaveBtnText, { color: colors.primaryLimeText }]}>
                    Save Seat
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Removal Confirmation Dialog */}
          {isConfirming && selectedSeatToRemove && (
            <View style={[styles.confirmBox, { backgroundColor: colors.dangerLight, borderColor: colors.danger }]}>
              <Text style={[styles.confirmTitle, { color: colors.danger }]}>
                {t.confirmRemovalTitle}
              </Text>
              <Text style={[styles.confirmMsg, { color: colors.textPrimary }]}>
                {t.confirmRemovalMsg.replace('{num}', selectedSeatToRemove.seatNumber.toString())}
              </Text>
              <View style={styles.confirmActionsRow}>
                <TouchableOpacity
                  style={[styles.cancelBtn, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}
                  onPress={handleCancelRemoval}
                >
                  <Text style={[styles.cancelBtnText, { color: colors.textSecondary }]}>
                    {t.cancelAction}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.deleteBtn, { backgroundColor: colors.danger }]}
                  onPress={handleConfirmRemoval}
                >
                  <Trash2 size={16} color="#FFFFFF" />
                  <Text style={styles.deleteBtnText}>{t.removeAction}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Seat List */}
          <View style={styles.listHeaderRow}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
              Passenger Seats ({seats.length})
            </Text>
            <Text style={[styles.listHint, { color: colors.textMuted }]}>
              Tap status to cycle • Tap edit to rename
            </Text>
          </View>

          <ScrollView style={styles.seatList} contentContainerStyle={styles.seatListContent} showsVerticalScrollIndicator={false}>
            {seats.map(s => {
              let statusColor = colors.unpaidText;
              let StatusIcon = Circle;
              let statusLabel = t.unpaid;
              let badgeBg = colors.unpaidBadgeBg;

              if (s.status === 'paid') {
                statusColor = colors.paidText;
                StatusIcon = CheckCircle2;
                statusLabel = t.paid;
                badgeBg = colors.paidBadgeBg;
              } else if (s.status === 'pending') {
                statusColor = colors.pendingText;
                StatusIcon = Clock;
                statusLabel = t.pending;
                badgeBg = colors.pendingBadgeBg;
              }

              return (
                <View
                  key={s.id}
                  style={[
                    styles.seatRow,
                    {
                      backgroundColor: colors.surfaceElevated,
                      borderColor: colors.borderSubtle,
                    },
                  ]}
                >
                  {/* Left: Seat identifier & label */}
                  <View style={styles.seatRowLeft}>
                    <View style={[styles.seatBadge, { backgroundColor: colors.surface }]}>
                      <Armchair size={16} color={colors.primaryForest} />
                    </View>
                    <View>
                      <Text style={[styles.seatRowNumber, { color: colors.textPrimary }]}>
                        {s.label || `Seat #${s.seatNumber}`}
                      </Text>
                      <Text style={[styles.seatRowSub, { color: colors.textMuted }]}>
                        ID: #{s.seatNumber}
                      </Text>
                    </View>
                  </View>

                  {/* Right: Interactive Status Pill + Edit + Delete */}
                  <View style={styles.seatRowActions}>
                    {/* Status Cycle Button */}
                    <TouchableOpacity
                      style={[styles.statusTogglePill, { backgroundColor: badgeBg }]}
                      onPress={() => handleCycleStatus(s)}
                      activeOpacity={0.7}
                    >
                      <StatusIcon size={12} color={statusColor} />
                      <Text style={[styles.statusToggleText, { color: statusColor }]}>
                        {statusLabel}
                      </Text>
                    </TouchableOpacity>

                    {/* Edit button */}
                    <TouchableOpacity
                      style={[styles.actionIconBtn, { backgroundColor: colors.surface }]}
                      onPress={() => handleStartEdit(s)}
                      activeOpacity={0.7}
                    >
                      <Edit2 size={15} color={colors.primaryForest} />
                    </TouchableOpacity>

                    {/* Delete button */}
                    <TouchableOpacity
                      style={[styles.actionIconBtn, { backgroundColor: colors.surface }]}
                      onPress={() => handleSelectSeatToRemove(s)}
                      activeOpacity={0.7}
                    >
                      <Trash2 size={15} color={colors.danger} />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </ScrollView>

          {/* Done Button */}
          <TouchableOpacity
            style={[styles.closeModalBtn, { backgroundColor: colors.primaryLime }]}
            onPress={onClose}
            activeOpacity={0.8}
          >
            <Text style={[styles.closeModalBtnText, { color: colors.primaryLimeText }]}>
              {t.done}
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
  modalCard: {
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
    marginBottom: 14,
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
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionsBar: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  primaryAddBtn: {
    flex: 1.4,
    height: 46,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  primaryAddBtnText: {
    fontSize: 13,
    fontWeight: '800',
  },
  quickSecondaryBtn: {
    flex: 1.2,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  quickSecondaryBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  warningText: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  editBox: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    marginBottom: 14,
  },
  editBoxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  editBoxTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  editInputsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  editInputLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  editInput: {
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
    fontWeight: '700',
  },
  statusPickerRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  statusChip: {
    flex: 1,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  editActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  editCancelBtn: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editCancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  editSaveBtn: {
    flex: 1.5,
    height: 40,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  editSaveBtnText: {
    fontSize: 13,
    fontWeight: '800',
  },
  confirmBox: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 14,
  },
  confirmTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 4,
  },
  confirmMsg: {
    fontSize: 12,
    marginBottom: 12,
  },
  confirmActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  deleteBtn: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  deleteBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  listHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  listHint: {
    fontSize: 11,
    fontWeight: '500',
  },
  seatList: {
    maxHeight: 270,
  },
  seatListContent: {
    gap: 8,
    paddingBottom: 10,
  },
  seatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    minHeight: 52,
  },
  seatRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  seatBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seatRowNumber: {
    fontSize: 14,
    fontWeight: '700',
  },
  seatRowSub: {
    fontSize: 11,
    marginTop: 1,
  },
  seatRowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusTogglePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
  },
  statusToggleText: {
    fontSize: 11,
    fontWeight: '700',
  },
  actionIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeModalBtn: {
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  closeModalBtnText: {
    fontSize: 15,
    fontWeight: '800',
  },
});
