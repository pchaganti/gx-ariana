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
                "px-2 py-1 rounded-md hover:opacity-90 transition-colors",
                className
            )}
            style={{
                backgroundColor: getThemeAwareColor(colors.background.accent, isDark),
                color: getThemeAwareColor(colors.text.primary, isDark)
            }}
            {...props}
        >
            Run
        </button>
    );
};

export default RunButton;
