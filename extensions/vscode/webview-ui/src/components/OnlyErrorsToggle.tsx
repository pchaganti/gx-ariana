import React from 'react';

interface OnlyErrorsToggleProps {
  enabled: boolean;
  onToggle: () => void;
}

const OnlyErrorsToggle: React.FC<OnlyErrorsToggleProps> = ({ enabled, onToggle }) => {
  return (
    <button
      onClick={onToggle}
      className={
        'text-[var(--fg-0)] px-3 rounded-md h-8 w-[15ch] cursor-pointer text-sm font-semibold ' +
        (enabled ? 'bg-red-600' : 'bg-[var(--bg-0)]')
      }
      title="Show only error traces"
    >
      Only Errors
    </button>
  );
};

export default OnlyErrorsToggle;
