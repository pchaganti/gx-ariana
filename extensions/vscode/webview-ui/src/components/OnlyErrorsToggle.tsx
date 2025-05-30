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
        'px-3 rounded-md h-8 w-[15ch] cursor-pointer text-sm font-semibold ' +
        (enabled ? 'bg-[var(--vscode-error-500)]' : 'bg-[var(--vscode-background)]')
      }
      title="Show only error traces"
    >
      Only Errors
    </button>
  );
};

export default OnlyErrorsToggle;
