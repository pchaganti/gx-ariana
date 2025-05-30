import React from 'react';
import { cn } from '../../lib/utils';

interface CodeBlockProps {
    children: React.ReactNode;
    language?: string;
    className?: string;
    disabled?: boolean;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ 
    children, 
    language = 'bash',
    className, 
    disabled = false 
}) => {
    return (
        <div className={cn(
            "p-3 rounded-md font-mono text-sm",
            disabled ? "bg-[var(--vscode-secondary-500)] text-[var(--vscode-foreground)] opacity-50" : "bg-[var(--vscode-secondary-500)] text-[var(--vscode-foreground)]",
            className
        )}>
            {children}
        </div>
    );
};

export default CodeBlock;
