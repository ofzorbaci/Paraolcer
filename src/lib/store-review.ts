import * as StoreReview from 'expo-store-review';

/** Shows the system review sheet if the store allows it; the OS may still decide not to. */
export async function requestReview(): Promise<boolean> {
  if (!(await StoreReview.isAvailableAsync())) return false;
  await StoreReview.requestReview();
  return true;
}
