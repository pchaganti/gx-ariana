import React from 'react';
import { postMessageToExtension } from '../utils/vscode';

interface ArianaCliStatus {
    isInstalled: boolean;
    version?: string;
    latestVersion?: string;
    needsUpdate: boolean;
    npmAvailable: boolean;
    pipAvailable: boolean;
    pythonPipAvailable: boolean;
    python3PipAvailable: boolean;
}

interface FooterProps {
    cliStatus: ArianaCliStatus | null;
    onUpdate?: () => void;
}

const Footer: React.FC<FooterProps> = ({ cliStatus, onUpdate }) => {
    const handleUpdate = () => {
        if (onUpdate) {
            onUpdate();
        } else {
            postMessageToExtension({ command: 'updateArianaCli' });
        }
    };

    return (
        <div className="h-[30px] px-4 py-1 bg-[var(--vscode-secondary-500)] flex justify-between items-center text-xs text-[var(--vscode-foreground)] opacity-70">
            <div>
                {cliStatus?.isInstalled && cliStatus.version && (
                    <span>
                        ariana - {cliStatus.version.split('ariana ')[1]}
                        {cliStatus.needsUpdate && (
                            <button 
                                className="ml-2 px-2 py-0.5 text-xs bg-[var(--vscode-accent-500)] text-[var(--vscode-foreground)] rounded-md hover:bg-opacity-90 transition-colors"
                                onClick={handleUpdate}
                            >
                                Update
                            </button>
                        )}
                    </span>
                )}
            </div>
            <a 
                href="https://discord.gg/Y3TFTmE89g" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-[var(--vscode-accent-500)] hover:underline"
                onClick={(e) => {
                    e.preventDefault();
                    postMessageToExtension({ 
                        command: 'openExternal', 
                        url: 'https://discord.gg/Y3TFTmE89g' 
                    });
                }}
            >
                give feedback & report bugs
            </a>
        </div>
    );
};

export default Footer;
