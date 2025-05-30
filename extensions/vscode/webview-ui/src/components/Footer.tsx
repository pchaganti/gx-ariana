import React from 'react';
import { ArianaCliStatus } from '../lib/cli';
import { postMessageToExtension } from '../utils/vscode';
import { useTheme } from '../hooks/useTheme';
import { colors, getThemeAwareColor } from '../utils/themeAwareColors';

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
            className="h-[30px] px-4 py-1 flex justify-between items-center text-xs" 
            style={{ 
                backgroundColor: 'var(--surface-code)',
                color: 'var(--text-muted)'
            }}
        >
            <div>
                {cliStatus?.isInstalled && cliStatus.version && (
                    <span>
                        ariana - {cliStatus.version.split('ariana ')[1]}
                        {cliStatus.needsUpdate && (
                            <button 
                                className="ml-2 px-2 py-0.5 text-xs rounded-md hover:opacity-90 transition-colors"
                                style={{
                                    backgroundColor: 'var(--interactive-default)',
                                    color: 'var(--text-on-emphasis)'
                                }}
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
                className="hover:underline"
                style={{ color: 'var(--interactive-default)' }}
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
