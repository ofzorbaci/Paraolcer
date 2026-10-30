import * as LocalAuthentication from 'expo-local-authentication';

/** True when the phone has a passcode, fingerprint or face set up that can guard the app. */
export async function lockAvailable(): Promise<boolean> {
  return (await LocalAuthentication.getEnrolledLevelAsync()) !== LocalAuthentication.SecurityLevel.NONE;
}

/** Face ID / fingerprint, falling back to the phone's own passcode. The app stores no PIN. */
export async function unlock(): Promise<boolean> {
  const r = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Paraölçer’in kilidini aç',
    cancelLabel: 'Vazgeç',
    fallbackLabel: 'Telefon şifresini kullan',
    disableDeviceFallback: false,
  });
  return r.success;
}
