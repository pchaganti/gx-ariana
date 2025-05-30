import React from 'react';
import { cn } from '../../lib/utils';

interface RunButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    className?: string;
}

const RunButton: React.FC<RunButtonProps> = ({
    className,
    ...props
}) => {
    return (
        <button 
            className={cn(
                "px-2 py-1 bg-[var(--vscode-accent-500)] text-[var(--vscode-foreground)] rounded-md hover:opacity-90 transition-colors",
                className
            )}
            {...props}
        >
            Run
        </button>
    );
};

export default RunButton;
