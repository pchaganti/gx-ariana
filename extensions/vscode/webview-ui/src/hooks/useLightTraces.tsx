import { useEffect, useState } from 'react';
import { postMessageToExtension } from '../utils/vscode';
import type { LightTrace } from '../bindings/LightTrace';

export function useLightTraces() {
  const [traces, setTraces] = useState<LightTrace[]>([]);

  useEffect(() => {
    // Request the current traces from the extension when the hook mounts
    postMessageToExtension({ command: 'getLightTraces' });

    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message.type === 'lightTraces') {
        setTraces(message.value);
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  return traces;
}
