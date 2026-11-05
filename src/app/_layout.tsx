import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';
import { Sora_700Bold } from '@expo-google-fonts/sora';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, router, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';

import { AppLock } from '@/components/app-lock';
import { onNotificationOpen } from '@/lib/notify';
import { loadBudget } from '@/state/budget';
import { loadStore } from '@/state/store';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
    Sora_700Bold,
  });
  const [dataLoaded, setDataLoaded] = useState(false);

  useEffect(() => {
    Promise.all([loadStore(), loadBudget()]).finally(() => setDataLoaded(true));
    // A tapped reminder opens the screen it is about, e.g. "Yenilesem mi?" for a maturing deposit.
    return onNotificationOpen((url) => router.push(url as never));
  }, []);

  // A font that fails to load falls back to the system font rather than blocking the app.
  const ready = (fontsLoaded || !!fontError) && dataLoaded;
  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AppLock>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false, title: 'Özet' }} />
        <Stack.Screen name="holding/edit" options={{ headerShown: false }} />
        <Stack.Screen name="holding/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="tools/calculator" options={{ headerShown: false }} />
        <Stack.Screen name="paywall" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="renew/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="method" options={{ headerShown: false }} />
        <Stack.Screen name="import" options={{ headerShown: false }} />
        <Stack.Screen name="karne" options={{ headerShown: false }} />
        <Stack.Screen name="budget/transaction" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="budget/account" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="budget/payment" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="budget/payments" options={{ headerShown: false }} />
        <Stack.Screen name="budget/analysis" options={{ headerShown: false }} />
        <Stack.Screen name="budget/statement" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="my-inflation" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="privacy-proof" options={{ headerShown: false }} />
      </Stack>
      </AppLock>
    </ThemeProvider>
  );
}
