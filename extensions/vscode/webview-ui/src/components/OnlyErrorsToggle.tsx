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
      className="px-3 rounded-md h-8 w-[15ch] cursor-pointer text-sm font-semibold"
      style={{
        backgroundColor: enabled ? 'var(--status-error)' : 'var(--surface-code)',
        color: enabled ? 'var(--surface-default)' : 'var(--text-default)'
      }}
      title="Show only error traces"
    >
      Only Errors
    </button>
  );
};

export default OnlyErrorsToggle;
