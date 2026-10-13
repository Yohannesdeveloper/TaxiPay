import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from './src/theme/ThemeContext';
import { LanguageProvider } from './src/localization/useTranslation';
import { AccessProvider } from './src/state/AccessContext';
import { AppGate } from './src/screens/AppGate';

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <LanguageProvider>
          <AccessProvider>
            <AppGate />
          </AccessProvider>
        </LanguageProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
