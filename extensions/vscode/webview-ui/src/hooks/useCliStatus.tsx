import { useEffect, useState } from 'react';
import { postMessageToExtension } from '../utils/vscode';
import type { ArianaCliStatus } from '../lib/cli';

export function useCliStatus() {
  const [cliStatus, setCliStatus] = useState<ArianaCliStatus | null>(null);

  useEffect(() => {
    postMessageToExtension({ command: 'getArianaCliStatus' });

    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message.type === 'arianaCliStatus') {
        setCliStatus(message.value);
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  return cliStatus;
}
