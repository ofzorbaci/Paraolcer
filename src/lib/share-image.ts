import * as Sharing from 'expo-sharing';
import type { ComponentRef, RefObject } from 'react';
import type { View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

/** Captures a view as a PNG and opens the share sheet; false if sharing is not possible. */
export async function shareViewImage(ref: RefObject<ComponentRef<typeof View> | null>, title: string): Promise<boolean> {
  if (!ref.current || !(await Sharing.isAvailableAsync())) return false;
  const uri = await captureRef(ref.current as Parameters<typeof captureRef>[0], { format: 'png', quality: 1, result: 'tmpfile' });
  await Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: title });
  return true;
}
