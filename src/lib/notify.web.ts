// Local notifications are not available in the web build.

export async function enableCpiReminders(): Promise<boolean> {
  return false;
}

export async function disableCpiReminders(): Promise<void> {}
