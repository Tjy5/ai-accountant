import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider as PaperProvider } from 'react-native-paper';
import { AuthProvider } from './src/auth/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';
import { ConfettiHost } from './src/components/ConfettiHost';
import { theme } from './src/theme';

export default function App() {
  return (
    <SafeAreaProvider>
      <PaperProvider theme={theme}>
        <AuthProvider>
          <StatusBar style="light" backgroundColor={theme.colors.background} />
          <AppNavigator />
          <ConfettiHost />
        </AuthProvider>
      </PaperProvider>
    </SafeAreaProvider>
  );
}
