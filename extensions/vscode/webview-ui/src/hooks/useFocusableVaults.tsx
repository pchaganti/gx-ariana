import { useEffect, useState } from 'react';
import { postMessageToExtension } from '../utils/vscode';
import type { VaultHistoryEntry } from '../components/VaultSelector'; // Using App.tsx's import source

export function useFocusableVaults() {
  const [focusableVaults, setFocusableVaults] = useState<VaultHistoryEntry[]>([]);
  const [isRefreshingVaults, setIsRefreshingVaults] = useState(false);

  useEffect(() => {
    // Initial fetch
    setIsRefreshingVaults(true);
    postMessageToExtension({ command: 'refreshFocusableVaults' });

    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message.type === 'focusableVaults') {
        setFocusableVaults(message.value);
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
