import { ReactNode } from 'react';
import { cn } from '../../lib/utils'; // Adjusted path for ui subdirectory

export type ToggleStyle = "base" | "info" | "warning" | "success" | "error" | "interactive";

interface ToggleProps {
  isOn: boolean;
  onToggle: () => void;
  children: ReactNode;
  isDark: boolean;
  className?: string;
  childrenClassName?: string;
  style?: ToggleStyle;
}

const getOnBackgroundClass = (style: ToggleStyle): string => {
  switch (style) {
    case 'base': return 'bg-[var(--accent-subtle)]';
    case 'info': return 'bg-[var(--info-subtle)]';
    case 'warning': return 'bg-[var(--warning-subtle)]';
    case 'success': return 'bg-[var(--success-subtle)]';
    case 'error': return 'bg-[var(--error-subtle)]';
    case 'interactive': return 'bg-[var(--interactive-muted)]';
    default: return 'bg-[var(--accent-subtle)]'; // Default to base style
  }
};

const getOnShadowClassDark = (style: ToggleStyle): string => {
  switch (style) {
    case 'base': return 'inset-shadow-[0_5px_10px_2.5px_var(--accent-muted)] group-hover:inset-shadow-[0_10px_20px_5px_var(--accent-muted)] opacity-50';
    case 'info': return 'inset-shadow-[0_5px_10px_2.5px_var(--info-muted)] group-hover:inset-shadow-[0_10px_20px_5px_var(--info-muted)] opacity-50';
    case 'warning': return 'inset-shadow-[0_5px_10px_2.5px_var(--warning-muted)] group-hover:inset-shadow-[0_10px_20px_5px_var(--warning-muted)] opacity-50';
    case 'success': return 'inset-shadow-[0_5px_10px_2.5px_var(--success-muted)] group-hover:inset-shadow-[0_10px_20px_5px_var(--success-muted)] opacity-50';
    case 'error': return 'inset-shadow-[0_5px_10px_2.5px_var(--error-muted)] group-hover:inset-shadow-[0_10px_20px_5px_var(--error-muted)] opacity-50';
    case 'interactive': return 'inset-shadow-[0_5px_10px_2.5px_var(--interactive-hover)] group-hover:inset-shadow-[0_10px_20px_5px_var(--interactive-hover)] opacity-50';
    default: return 'inset-shadow-[0_5px_10px_2.5px_var(--accent-muted)] group-hover:inset-shadow-[0_10px_20px_5px_var(--accent-muted)] opacity-50';
  }
};

const getOnShadowClassLight = (style: ToggleStyle): string => {
  switch (style) {
    case 'base': return 'inset-shadow-[0_-5px_10px_2.5px_var(--accent-muted)] group-hover:inset-shadow-[0_-10px_20px_5px_var(--accent-muted)] opacity-50';
    case 'info': return 'inset-shadow-[0_-5px_10px_2.5px_var(--info-muted)] group-hover:inset-shadow-[0_-10px_20px_5px_var(--info-muted)] opacity-50';
    case 'warning': return 'inset-shadow-[0_-5px_10px_2.5px_var(--warning-muted)] group-hover:inset-shadow-[0_-10px_20px_5px_var(--warning-muted)] opacity-50';
    case 'success': return 'inset-shadow-[0_-5px_10px_2.5px_var(--success-muted)] group-hover:inset-shadow-[0_-10px_20px_5px_var(--success-muted)] opacity-50';
    case 'error': return 'inset-shadow-[0_-5px_10px_2.5px_var(--error-muted)] group-hover:inset-shadow-[0_-10px_20px_5px_var(--error-muted)] opacity-50';
    case 'interactive': return 'inset-shadow-[0_-5px_10px_2.5px_var(--interactive-hover)] group-hover:inset-shadow-[0_-10px_20px_5px_var(--interactive-hover)] opacity-50';
    default: return 'inset-shadow-[0_-5px_10px_2.5px_var(--accent-muted)] group-hover:inset-shadow-[0_-10px_20px_5px_var(--accent-muted)] opacity-50';
  }
};

const Toggle = ({ isOn, onToggle, children, isDark, className, childrenClassName, style }: ToggleProps) => {
  const currentStyle = style || 'base';

  return (
    <button
      onClick={onToggle}
      className={cn(
        "group z-0 text-left relative rounded-2xl h-fit overflow-hidden cursor-pointer",
        isOn ? 'opacity-100' : 'opacity-70 hover:opacity-100',
        isDark ? "shadow-[0_5px_5px_3px_var(--bg-600)]" : "shadow-[0_5px_5px_3px_var(--bg-550)]",
        isOn
          ? getOnBackgroundClass(currentStyle)
          : (isDark ? "bg-[var(--bg-400)]" : "bg-[var(--bg-550)]"),
        className
      )}
    >
      <div
        className={cn(
          "absolute w-full h-full bg-transparent transition-all",
          isOn
            ? (isDark ? getOnShadowClassDark(currentStyle) : getOnShadowClassLight(currentStyle))
            : (isDark ? "inset-shadow-[0_5px_10px_2.5px_var(--bg-200)] group-hover:inset-shadow-[0_10px_20px_5px_var(--bg-200)]" : "inset-shadow-[0_5px_10px_2.5px_var(--bg-600)] group-hover:inset-shadow-[0_10px_20px_5px_var(--bg-600)]")
        )}
      />
      <div
        className={cn(
          "w-full h-full flex flex-col justify-center px-6 py-4 transition-all relative z-10",
          childrenClassName
        )}
      >
        {children}
      </div>
    </button>
  );
};

export default Toggle;
export type { ToggleProps }; // Exporting ToggleProps for external use if needed
