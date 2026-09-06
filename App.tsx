import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from './src/theme/ThemeContext';
import { LanguageProvider } from './src/localization/useTranslation';
import { TaxiProvider } from './src/state/TaxiContext';
import { DashboardScreen } from './src/screens/DashboardScreen';

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <LanguageProvider>
          <TaxiProvider>
            <DashboardScreen />
          </TaxiProvider>
        </LanguageProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
