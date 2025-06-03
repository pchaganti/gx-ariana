import { useEffect, useState } from 'react';
import { postMessageToExtension } from '../utils/vscode';
import type { Trace } from '../bindings/Trace';

export function useTraces() {
  const [traces, setTraces] = useState<Trace[]>([]);

  useEffect(() => {
    // Request the current traces from the extension when the hook mounts
    postMessageToExtension({ command: 'getTraces' });

    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message.type === 'traces') {
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
