import { useState, useEffect, useRef } from 'react';
import { postMessageToExtension } from '../utils/vscode';
import { ChevronDown, Check, RefreshCw } from 'lucide-react';
import { StoredVaultData } from '../types/vaults';
import { useFocusableVaults } from '../hooks/useFocusableVaults';
import { useFocusedVault } from '../hooks/useFocusedVault';

// isRefreshing and onRefresh are now handled by the useFocusableVaults hook directly
// If direct control from parent is needed for these, they can be added back as optional props.
interface VaultSelectorProps {
    // No props needed for vault data anymore
}

const VaultSelector = ({ }: VaultSelectorProps) => {
    const { focusableVaults, isRefreshingVaults: isRefreshing, refreshFocusableVaults: onRefresh } = useFocusableVaults();
    const { focusedVault } = useFocusedVault();
    const [isOpen, setIsOpen] = useState(false);
    const selectorRef = useRef<HTMLDivElement>(null);
    
    console.log('focusableVaults', focusableVaults);
    console.log('focusedVault', focusedVault);

    // Format time to be user-friendly
    // Format time to be user-friendly, using created_at from StoredVaultData
    const formatTimeAgo = (timestamp: number) => {
        const now = Date.now();
        const diffMs = now - (timestamp * 1000);
        const diffSec = Math.floor(diffMs / 1000);
        const diffMin = Math.floor(diffSec / 60);
        const diffHour = Math.floor(diffMin / 60);
        const diffDay = Math.floor(diffHour / 24);
        const diffWeek = Math.floor(diffDay / 7);
        const diffMonth = Math.floor(diffDay / 30);

        // Format date for display with time
        const formatDate = (date: Date) => {
            const hours = date.getHours();
            const minutes = date.getMinutes();
            const ampm = hours >= 12 ? 'pm' : 'am';
            const formattedHours = hours % 12 || 12;
            const formattedMinutes = minutes < 10 ? `0${minutes}` : minutes;
            return `${formattedHours}:${formattedMinutes}${ampm}`;
        };

        if (diffSec < 60) {
            return `Run started ${diffSec} seconds ago`;
        } else if (diffMin < 60) {
            return `Run started ${diffMin} minutes ago`;
        } else if (diffHour < 48) {
            return `Run started ${diffHour} hours ago`;
        } else if (diffDay < 7) {
            return `Run started ${diffDay} days ago at ${formatDate(new Date(timestamp))}`;
        } else if (diffWeek < 4) {
            return `Run started ${diffWeek} weeks ago`;
        } else {
            return `Run started ${diffMonth} months ago`;
        }
    };

    // Handle clicking outside to close the dropdown
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (selectorRef.current && !selectorRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // Handle vault selection
    const handleVaultSelect = (vault: StoredVaultData) => {
        postMessageToExtension({
            command: 'focusVault',
            vaultData: vault // Send the full StoredVaultData object
        });
        setIsOpen(false);
    };

    const toggleDropdown = () => {
        if (focusableVaults.length > 0) {
            setIsOpen(!isOpen);
        }
    };

    // Find the focused vault entry to get its timestamp
    const focusedVaultEntry = focusedVault; // focusedVault is now StoredVaultData | null

    return (
        <div 
            ref={selectorRef}
            className="relative text-[var(--text-default)]"
        >
            <div className="flex items-center justify-between gap-2">
                <div 
                    onClick={toggleDropdown}
                    className={`flex flex-1 items-center justify-between p-2 cursor-pointer rounded-md bg-[var(--surface-code)] ${focusableVaults.length > 0 ? 'hover:bg-[var(--interactive-hover)]' : 'opacity-70'}`}
                >
                    <div className="flex flex-col">
                        <div className="text-sm font-semibold">
                            {focusedVaultEntry 
                                ? `${focusedVaultEntry.command} (${formatTimeAgo(focusedVaultEntry.created_at)})`
                                : (focusableVaults.length > 0 ? 'Select a run' : 'No runs available')}
                        </div>
                        <div className="text-xs text-[var(--text-muted)]">
                            {focusedVaultEntry?.command} in {focusedVaultEntry?.dir}
                        </div>
                    </div>
                    {focusableVaults.length > 0 && (
                        <ChevronDown 
                            size={16} 
                            className={`transition-transform ${isOpen ? 'transform rotate-180' : ''}`} 
                        />
                    )}
                </div>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onRefresh && onRefresh();
                    }}
                    className="p-2 h-full flex items-center justify-center rounded-md hover:bg-[var(--surface-code)]">
                    <RefreshCw 
                        size={16} 
                        className={`${isRefreshing ? 'animate-spin' : ''}`} 
                    />
                </button>
            </div>

            {isOpen && focusableVaults.length > 0 && (
                <div className="absolute w-full bg-[var(--surface-raised)] rounded-b-md shadow-lg z-70">
                    <ul className="py-1 max-h-[40vh] overflow-y-auto">
                        {focusableVaults.map((vault) => (
                            <li 
                                key={vault.secret_key} // Use secret_key for key
                                onClick={() => handleVaultSelect(vault)} // Pass the full vault object
                                className={`flex items-center justify-between px-3 py-2 text-sm cursor-pointer hover:bg-[var(--surface-code)] ${focusedVault?.secret_key === vault.secret_key ? 'bg-[var(--interactive-active)]' : ''}`}
                            >
                                <div className="flex flex-col">
                                    <div className="text-sm font-semibold">
                                        {vault.command} ({formatTimeAgo(vault.created_at)}) {/* Display command and formatted created_at */}
                                    </div>
                                    <div className="text-xs text-[var(--text-muted)]">
                                        in {vault.dir} {/* Display dir, command is already shown above */}
                                    </div>
                                </div>
                                {focusedVault?.secret_key === vault.secret_key && <Check size={16} />}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default VaultSelector;
