import { useEffect, useState } from 'react';
import { postMessageToExtension } from '../utils/vscode';

export function useTheme() {
  const [isDark, setIsDark] = useState(true); // Default to dark theme

  useEffect(() => {
    // Request initial theme state
    postMessageToExtension({ command: 'getTheme' });

    // Listen for theme changes from VS Code
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message.type === 'theme') {
        setIsDark(message.isDark);
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  return {
    isDark,
    theme: isDark ? 'dark' : 'light'
  };
}
