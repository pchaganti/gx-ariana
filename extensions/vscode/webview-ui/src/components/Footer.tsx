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
        <div className="h-[30px] px-4 py-1 bg-[var(--bg-2)] flex justify-between items-center text-xs text-[var(--fg-2)]">
            <div>
                {cliStatus?.isInstalled && cliStatus.version && (
                    <span>
                        ariana - {cliStatus.version.split('ariana ')[1]}
                        {cliStatus.needsUpdate && (
                            <button 
                                className="ml-2 px-2 py-0.5 text-xs bg-[var(--accent)] text-[var(--fg-3)] rounded-md hover:bg-opacity-90 transition-colors"
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
                className="text-[var(--accent)] hover:underline"
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
