import { useState, useEffect } from 'react';
import { postMessageToExtension } from '../utils/vscode';
import { StoredVaultData } from '../types/vaults';
import { useFocusableVaults } from '../hooks/useFocusableVaults';
import { useFocusedVault } from '../hooks/useFocusedVault';
import { cn } from '../lib/utils';
import { useTheme } from '../hooks/useTheme';
import { formatTimeAgo } from '../utils/timeRepr';
import React from 'react';
import { useCliStatus } from '../hooks/useCliStatus';
import Toggle from './ui/Toggle'; // Added import for Toggle component
import TracesTab from './TracesTab';

const VaultItem = ({ vault }: { vault: StoredVaultData }) => {
    const { isDark } = useTheme();

    const { focusedVault } = useFocusedVault();

    // Handle vault selection
    const handleVaultSelect = (vault: StoredVaultData) => {
        if (vault.secret_key === focusedVault?.secret_key) {
            postMessageToExtension({
                command: 'focusVault',
                vaultData: null
            });
            return;
        }
        postMessageToExtension({
            command: 'focusVault',
            vaultData: vault
        });
        // Also tell the extension to show this vault in the detail panel
        postMessageToExtension({
            command: 'showTimelinePanel',
            vaultId: vault.secret_key
        });
    };
    
    return (
        <Toggle 
            isOn={vault.secret_key === focusedVault?.secret_key}
            onToggle={() => handleVaultSelect(vault)}
            isDark={isDark}
            style="interactive"
            className="rounded-l-none"
            childrenClassName='!pl-4'
        >
            <div className={cn(
            "flex flex-col transition-all text-[var(--fg-base)]",
            )}
            >
                <div className='flex gap-2 flex-wrap gap-y-0'>
                    {vault.cwd && (
                        <div className='font-mono text-[var(--text-subtle)] leading-4'>
                            {vault.cwd}{">"}
                        </div>
                    )}
                    <div className='font-mono text-[var(--info-base)] leading-4'>
                        {vault.command}
                    </div>
                </div>
                <div className='text-xs'>
                    Ran on this machine {formatTimeAgo(vault.created_at)}
                </div>
            </div>
        </Toggle>
    );
};

interface VaultSelectionProps {
}

const VaultSelection = ({ }: VaultSelectionProps) => {
    const { isDark } = useTheme();
    const cliStatus = useCliStatus();

    const { focusedVault } = useFocusedVault();
    const { focusableVaults, isRefreshingVaults: isRefreshing, refreshFocusableVaults: onRefresh } = useFocusableVaults();
    const [showVaultsOnTop, setShowVaultsOnTop] = useState(false);
    
    useEffect(() => {
        if (focusedVault) {
            setShowVaultsOnTop(false);
        }
    }, [focusedVault]);

    return (
        <div className={cn(
            'relative z-0 w-full h-full max-h-[83vh] overflow-y-auto',
            focusedVault ? 'min-h-[50vh]' : 'min-h-[30vh]'
        )}>
            {focusedVault && (
                <div className={cn(
                    "absolute top-0 left-0 w-full h-full pointer-events-none py-0.5 pl-10",
                    showVaultsOnTop ? "z-auto" : "z-10"
                )}>
                    <div className={cn(
                        "w-full h-full rounded-l-xl backdrop-blur-[2px] bg-gradient-to-bl from-[var(--bg-600)] to-transparent pointer-events-auto",
                    )}>
                        <TracesTab/>
                    </div>
                </div>
            )}
            <div className={cn(
                    "flex-1 py-2.5 pr-4 flex flex-col gap-2"
                )}
                onMouseEnter={() => setShowVaultsOnTop(true)}
                onMouseLeave={() => setShowVaultsOnTop(false)}
            >
                <div className="flex flex-col gap-2 backdrop-blur-[3px]">
                    {focusableVaults.map((vault) => (
                        <React.Fragment key={vault.secret_key}>
                            <VaultItem vault={vault} />
                        </React.Fragment>
                    ))}
                    {focusableVaults.length === 0 && (
                        <div className="flex-1 min-h-[300px] flex items-center justify-center">
                            <div className="flex flex-col gap-2 text-[var(--text-muted)] text-xs text-center">
                                <div className="text-base">✖️ No runs available.</div>
                                {cliStatus && cliStatus?.isInstalled ? 
                                (
                                    <div className="flex flex-col gap-0.5">
                                        <div>Build and run your code in the terminal with the <span className="font-mono text-[var(--interactive-active)]">ariana</span> command as a prefix.</div>
                                        <div>For example: <span className="font-mono text-[var(--interactive-active)]">ariana python my_script.py</span></div>
                                    </div>
                                )
                            : (
                                <div>Follow the Getting Started guide in the Welcome section above.</div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default VaultSelection;
