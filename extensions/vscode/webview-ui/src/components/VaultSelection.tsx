import { useState, useEffect, useRef } from 'react';
import { postMessageToExtension } from '../utils/vscode';
import { ChevronDown, Check, RefreshCw } from 'lucide-react';
import { StoredVaultData } from '../types/vaults';
import { useFocusableVaults } from '../hooks/useFocusableVaults';
import { useFocusedVault } from '../hooks/useFocusedVault';
import { cn } from '../lib/utils';
import { useTheme } from '../hooks/useTheme';
import { formatTimeAgo } from '../utils/timeRepr';
import React from 'react';

const VaultItem = ({ vault }: { vault: StoredVaultData }) => {
    const { isDark } = useTheme();

    const { focusedVault } = useFocusedVault();

    // Handle vault selection
    const handleVaultSelect = (vault: StoredVaultData) => {
        postMessageToExtension({
            command: 'focusVault',
            vaultData: vault // Send the full StoredVaultData object
        });
    };
    
    return (
        <button onClick={() => handleVaultSelect(vault)} className={cn(
            "group opacity-50 hover:opacity-100 text-left relative rounded-2xl h-fit w-full overflow-hidden",
            isDark ? "shadow-[0_5px_5px_3px_var(--bg-600)]" : "shadow-[0_5px_5px_3px_var(--bg-550)]",
            vault.secret_key === focusedVault?.secret_key ? (
                "bg-[var(--info-subtle)] opacity-100"
            ) : (
                isDark ? "bg-[var(--bg-400)]" : "bg-[var(--bg-550)]"
            ),
        )}>
            <div className={cn(
                "absolute w-full h-full bg-transparent z-30 transition-all",
                focusedVault?.secret_key === vault.secret_key ? 
                ("")
                : (isDark ? "inset-shadow-[0_5px_10px_2.5px_var(--bg-200)] hover:inset-shadow-[0_10px_20px_5px_var(--bg-200)]" : "inset-shadow-[0_5px_10px_2.5px_var(--bg-600)] hover:inset-shadow-[0_10px_20px_5px_var(--bg-600)]"),
            )}>
            </div>
            <div className={cn(
                "w-full h-full flex flex-col justify-center px-6 py-4 transition-all",
            )}
            >
                <div className={cn(
                "flex flex-col transition-all text-[var(--fg-base)]",
                )}>
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
            </div>
        </button>
    );
}

// isRefreshing and onRefresh are now handled by the useFocusableVaults hook directly
// If direct control from parent is needed for these, they can be added back as optional props.
interface VaultSelectionProps {
    // No props needed for vault data anymore
}

const VaultSelection = ({ }: VaultSelectionProps) => {
    const { isDark } = useTheme();

    const { focusableVaults, isRefreshingVaults: isRefreshing, refreshFocusableVaults: onRefresh } = useFocusableVaults();

    return (
        <div className={cn(
            "flex-1 p-2.5 flex flex-col gap-2"
        )}>
            {/* {focusedVault && (<div className={cn(
                "p-2 border-4 border-double border-[var(--border-subtle)] rounded-3xl"
            )}>
                <VaultItem vault={focusedVault} />
            </div>)} */}
            {focusableVaults.map((vault) => (
                <React.Fragment key={vault.secret_key}>
                    <VaultItem vault={vault} />
                </React.Fragment>
            ))}
        </div>
    );
};

export default VaultSelection;
