import { useEffect, useState } from 'react';
import { postMessageToExtension } from '../utils/vscode';
import { StoredVaultData } from '../types/vaults';

export function useFocusableVaults() {
  const [focusableVaults, setFocusableVaults] = useState<StoredVaultData[]>([]);
  const [isRefreshingVaults, setIsRefreshingVaults] = useState(false);

  useEffect(() => {
    // Initial fetch
    setIsRefreshingVaults(true);
    postMessageToExtension({ command: 'refreshFocusableVaults' });

    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message.type === 'focusableVaults') {
        setFocusableVaults(message.value as StoredVaultData[]);
        setIsRefreshingVaults(false);
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  const refreshFocusableVaults = () => {
    setIsRefreshingVaults(true);
    postMessageToExtension({ command: 'refreshFocusableVaults' });
  };

  return { focusableVaults, isRefreshingVaults, refreshFocusableVaults };
}
