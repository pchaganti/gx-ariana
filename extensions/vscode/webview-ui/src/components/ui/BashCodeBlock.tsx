import React from 'react';
import CodeBlock from './CodeBlock';

interface BashCodeBlockProps {
    command: string;
    disabled?: boolean;
    className?: string;
}

const BashCodeBlock: React.FC<BashCodeBlockProps> = ({ 
    command, 
    disabled = false,
    className 
}) => {
    return (
        <CodeBlock 
            // language="bash" 
            disabled={disabled}
            className={className}
        >
            {command}
        </CodeBlock>
    );
};

export default BashCodeBlock;
