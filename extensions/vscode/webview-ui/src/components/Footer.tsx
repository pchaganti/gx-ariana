import React from 'react';
import { ArianaCliStatus } from '../lib/cli';
import { postMessageToExtension } from '../utils/vscode';
import { useTheme } from '../hooks/useTheme';

interface FooterProps {
    cliStatus: ArianaCliStatus | null;
    onUpdate?: () => void;
}

const Footer: React.FC<FooterProps> = ({ cliStatus, onUpdate }) => {
    const { isDark } = useTheme();

    const handleUpdate = () => {
        if (onUpdate) {
            onUpdate();
        } else {
            postMessageToExtension({ command: 'updateArianaCli' });
        }
    };

    return (
        <div 
            className="flex justify-between items-center text-xs" 
            style={{ 
                backgroundColor: 'var(--surface-code)',
                color: 'var(--text-muted)'
            }}
        >
            <div className="px-4 py-1">
                {cliStatus?.isInstalled && cliStatus.version && (
                    <span>
                        ariana - {cliStatus.version.split('ariana ')[1]}
                        {cliStatus.needsUpdate && (
                            <button 
                                className="ml-2 pl-2 pr-3 py-0.5 text-xs cursor-pointer rounded-full hover:opacity-90 transition-colors"
                                style={{
                                    backgroundColor: 'var(--interactive-active)',
                                    color: isDark ? 'var(--fg-base)' : 'var(--bg-base)'
                                }}
                                onClick={handleUpdate}
                            >
                                ⚠️ Click here to update the CLI
                            </button>
                        )}
                    </span>
                )}
            </div>
            <a 
                href="https://discord.gg/Y3TFTmE89g" 
                target="_blank" 
                rel="noopener noreferrer"
                className={`hover:underline px-4 py-1 bg-[var(--interactive-active)] ${isDark ? '!text-[var(--text-default)]' : '!text-[var(--surface-default)]'}`}
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
