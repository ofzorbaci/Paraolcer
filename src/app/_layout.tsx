import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';
import { Sora_700Bold } from '@expo-google-fonts/sora';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';

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
    loadStore().finally(() => setDataLoaded(true));
  }, []);

  // A font that fails to load falls back to the system font rather than blocking the app.
  const ready = (fontsLoaded || !!fontError) && dataLoaded;
  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false, title: 'Özet' }} />
        <Stack.Screen name="holding/edit" options={{ headerShown: false }} />
        <Stack.Screen name="holding/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="tools/calculator" options={{ headerShown: false }} />
        <Stack.Screen name="paywall" options={{ headerShown: false, presentation: 'modal' }} />
      </Stack>
    </ThemeProvider>
  );
}
