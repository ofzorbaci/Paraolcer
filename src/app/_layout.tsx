import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { loadStore } from '@/state/store';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    loadStore().finally(() => SplashScreen.hideAsync());
  }, []);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false, title: 'Özet' }} />
        <Stack.Screen name="holding/edit" options={{ headerShown: false }} />
        <Stack.Screen name="holding/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="tools/calculator" options={{ headerShown: false }} />
      </Stack>
    </ThemeProvider>
  );
}
