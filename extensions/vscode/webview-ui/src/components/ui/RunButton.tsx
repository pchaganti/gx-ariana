import React from 'react';
import { cn } from '../../lib/utils';
import { Button } from './button';

interface RunButtonProps {
    onClick: () => void;
    className?: string;
    disabled?: boolean;
    children?: React.ReactNode;
}

const RunButton: React.FC<RunButtonProps> = ({ 
    onClick, 
    className, 
    disabled = false,
    children = 'Run in Terminal'
}) => {
    return (
        <Button
            className={cn(
                "mt-2 w-full p-2 bg-[var(--accent)] text-[var(--fg-3)] rounded-md hover:bg-opacity-90 transition-colors",
                className
            )}
            onClick={onClick}
            disabled={disabled}
        >
            {children}
        </Button>
    );
};

export default RunButton;
