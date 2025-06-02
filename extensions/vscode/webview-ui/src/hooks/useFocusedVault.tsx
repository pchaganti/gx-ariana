import { useEffect, useState } from 'react';
import { StoredVaultData } from '../types/vaults';
import { postMessageToExtension } from '../utils/vscode'; // Import the existing utility

export function useFocusedVault() {
  const [focusedVault, setFocusedVault] = useState<StoredVaultData | null>(null);

  useEffect(() => {
    // Request the current focused vault state from the extension when the hook mounts
    postMessageToExtension({ command: 'getFocusedVault' });

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
