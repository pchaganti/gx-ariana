import { useSharedState } from './shared/useSharedState';

export function useTheme() {
  const isDark = useSharedState<boolean>(
    'theme',
    true, // Default to dark theme
    'theme',
    'getTheme',
    (message) => message.isDark
  );

  return {
    isDark,
    theme: isDark ? 'dark' : 'light',
  };
}
