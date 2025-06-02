import { useEffect, useState } from 'react';
import { StoredVaultData } from '../types/vaults';

export function useFocusedVault() {
  const [focusedVault, setFocusedVault] = useState<StoredVaultData | null>(null);

  useEffect(() => {
    // Request initial focused vault state when component mounts
    // The extension should send 'focusedVault' message upon connection or when it changes.
    // No explicit fetch command here, assuming passive updates from extension.

    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message.type === 'focusedVault') {
        setFocusedVault(message.value as StoredVaultData | null);
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  return { focusedVault };
}
