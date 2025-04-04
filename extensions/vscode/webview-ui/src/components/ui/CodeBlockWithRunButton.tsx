import React from 'react';
import CodeBlock from './CodeBlock';
import RunButton from './RunButton';

interface CodeBlockWithRunButtonProps {
    code: string;
    language?: string;
    onRun: () => void;
    disabled?: boolean;
    buttonText?: string;
    className?: string;
}

const CodeBlockWithRunButton: React.FC<CodeBlockWithRunButtonProps> = ({
    code,
    language = 'bash',
    onRun,
    disabled = false,
    buttonText = 'Run in Terminal',
    className
}) => {
    return (
        <div className={className}>
            <CodeBlock language={language} disabled={disabled}>
                {code}
            </CodeBlock>
            <RunButton 
                onClick={onRun} 
                disabled={disabled}
            >
                {buttonText}
            </RunButton>
        </div>
    );
};

export default CodeBlockWithRunButton;
