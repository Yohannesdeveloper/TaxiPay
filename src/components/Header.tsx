import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Car, Settings, Sun, Moon, Globe } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import { useTranslation } from '../localization/useTranslation';

interface HeaderProps {
  onOpenSeatManager: () => void;
  onOpenTripConfig: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenSeatManager, onOpenTripConfig }) => {
  const { colors, mode, toggleTheme } = useTheme();
  const { t, language, toggleLanguage } = useTranslation();

  return (
    <View style={[styles.container, { backgroundColor: colors.headerBackground }]}>
      <View style={styles.topRow}>
        {/* Brand Logo & Title */}
        <TouchableOpacity 
          style={styles.brandContainer} 
          onPress={onOpenTripConfig}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Open trip settings"
        >
          <View style={[styles.logoIconWrapper, { backgroundColor: colors.primaryLime }]}>
            <Car size={22} color={colors.primaryLimeText} strokeWidth={2.5} />
          </View>
          <View>
            <View style={styles.brandRow}>
              <Text style={[styles.brandTitle, { color: colors.headerText }]}>
                {t.appName}
              </Text>
              <View style={[styles.demoTag, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
                <Text style={styles.demoTagText}>{t.demoBadge}</Text>
              </View>
            </View>
            <Text style={[styles.brandSubtitle, { color: colors.headerSubtext }]}>
              {t.subtitle}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Action Controls */}
        <View style={styles.actionsContainer}>
          {/* Language Toggle */}
          <TouchableOpacity
            style={[styles.iconButton, { backgroundColor: 'rgba(255,255,255,0.12)' }]}
            onPress={toggleLanguage}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`Switch language. Current: ${language.toUpperCase()}`}
          >
            <Globe size={18} color="#FFFFFF" />
            <Text style={styles.langText}>{language === 'en' ? 'አማ' : 'EN'}</Text>
          </TouchableOpacity>

          {/* Theme Toggle */}
          <TouchableOpacity
            style={[styles.iconButton, { backgroundColor: 'rgba(255,255,255,0.12)' }]}
            onPress={toggleTheme}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`Switch to ${mode === 'light' ? 'dark' : 'light'} mode`}
          >
            {mode === 'light' ? (
              <Moon size={18} color="#FFFFFF" />
            ) : (
              <Sun size={18} color="#FFFFFF" />
            )}
          </TouchableOpacity>

          {/* Admin Manage Seats */}
          <TouchableOpacity
            style={[styles.adminButton, { backgroundColor: colors.primaryLime }]}
            onPress={onOpenSeatManager}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={t.manageSeats}
          >
            <Settings size={17} color={colors.primaryLimeText} />
            <Text style={[styles.adminButtonText, { color: colors.primaryLimeText }]}>
              {t.manageSeats}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 48,
  },
  logoIconWrapper: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  demoTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  demoTagText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  brandSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 1,
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    height: 44,
    minWidth: 44,
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
  adminButton: {
    height: 44,
    paddingHorizontal: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  adminButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
