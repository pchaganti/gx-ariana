import React from 'react';
import { useTheme } from '../hooks/useTheme';
import { colors, getThemeAwareColor } from '../utils/themeAwareColors';

interface OnlyErrorsToggleProps {
  enabled: boolean;
  onToggle: () => void;
}

const OnlyErrorsToggle: React.FC<OnlyErrorsToggleProps> = ({ enabled, onToggle }) => {
  const { isDark } = useTheme();
  return (
    <button
      onClick={onToggle}
      className={`px-3 rounded-md h-8 w-[15ch] cursor-pointer text-sm font-semibold ${enabled ? 'bg-[var(--error-base)] text-[var(--text-on-emphasis)]' : 'bg-[var(--surface-code)] text-[var(--text-default)]'}`}
      title="Show only error traces"
    >
      Only Errors
    </button>
  );
};

export default OnlyErrorsToggle;
