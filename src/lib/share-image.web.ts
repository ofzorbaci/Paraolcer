import type { ComponentRef, RefObject } from 'react';
import type { View } from 'react-native';

// Image sharing needs the native share sheet; the web build shows the card only.
export async function shareViewImage(_ref: RefObject<ComponentRef<typeof View> | null>, _title: string): Promise<boolean> {
  return false;
}
