import { useStore } from '@/state/store';

/**
 * Subscribes a component to the "hide amounts" switch. formatTL reads the switch itself; this
 * hook only makes sure the component re-renders when it flips.
 */
export function useMasked(): boolean {
  return useStore((s) => s.settings.hideAmounts ?? false);
}
