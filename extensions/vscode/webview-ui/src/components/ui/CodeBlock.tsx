import React from 'react';
import { cn } from '../../lib/utils';
import { useTheme } from '../../hooks/useTheme';
import { colors, getThemeAwareColor } from '../../utils/themeAwareColors';

interface CodeBlockProps {
    children: React.ReactNode;
    disabled?: boolean;
    className?: string;
}

const CodeBlock: React.FC<CodeBlockProps> = ({
    children,
    disabled = false,
    className
}) => {
    const { isDark } = useTheme();
    const textColor = getThemeAwareColor(colors.text.default, isDark);

    return (
        <div 
            className={cn(
                "p-3 rounded-md font-mono text-sm",
                className
            )}
            style={{
                backgroundColor: 'var(--surface-code)',
                color: textColor,
                opacity: disabled ? 0.5 : 1
            }}
        >
            {children}
        </div>
    );
};

export default CodeBlock;
