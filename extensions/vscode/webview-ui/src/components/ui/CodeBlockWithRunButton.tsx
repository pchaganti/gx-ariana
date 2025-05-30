import React from 'react';
import RunButton from './RunButton';
import { useTheme } from '../../hooks/useTheme';
import { colors, getThemeAwareColor } from '../../utils/themeAwareColors';
import { cn } from '../../lib/utils';

interface CodeBlockWithRunButtonProps {
    code: string;
    onRun: () => void;
    disabled?: boolean;
    className?: string;
}

const CodeBlockWithRunButton: React.FC<CodeBlockWithRunButtonProps> = ({
    code,
    onRun,
    disabled = false,
    className
}) => {
    const { isDark } = useTheme();
    const textColor = getThemeAwareColor(colors.text.default, isDark);

    return (
        <div 
            className={cn("group rounded-xl overflow-hidden p-1", className)}
            style={{ backgroundColor: 'var(--surface-code)' }}
        >
            <div className="relative">
                <div 
                    className="px-2 py-1 font-mono"
                    style={{ color: textColor }}
                >
                    {code}
                </div>
                <button 
                    className="group-hover:block text-sm hidden absolute top-0 right-0 px-2 h-full rounded-md hover:opacity-100 opacity-50 transition-colors cursor-pointer bg-[var(--interactive-default)] hover:bg-[var(--interactive-hover)]"
                    onClick={onRun}
                    disabled={disabled}
                    style={{
                        color: 'var(--text-on-emphasis)'
                    }}
                >
                    Run
                </button>
            </div>
        </div>
    );
};

export default CodeBlockWithRunButton;
