import { Stack } from 'expo-router';
import { ThemeProvider, DefaultTheme } from '@react-navigation/native';
import { AuthProvider } from '../context/AuthContext';

export default function RootLayout() {
  return (
    <ThemeProvider value={DefaultTheme}>
      <AuthProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
        </Stack>
      </AuthProvider>
    </ThemeProvider>
  );
}
