import React from 'react';
import { cn } from '../../lib/utils';
import { useTheme } from '../../hooks/useTheme';
import { colors, getThemeAwareColor } from '../../utils/themeAwareColors';

interface RunButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    className?: string;
}

const RunButton: React.FC<RunButtonProps> = ({
    className,
    ...props
}) => {
    const { isDark } = useTheme();
    return (
        <button 
            className={cn(
                "px-2 py-1 rounded-md transition-colors bg-[var(--interactive-default)] hover:bg-[var(--interactive-hover)]",
                className
            )}
            style={{
                color: 'var(--text-on-emphasis)'
            }}
            {...props}
        >
            Run
        </button>
    );
};

export default RunButton;
