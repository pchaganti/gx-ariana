import { useState, useEffect, useRef } from 'react';
import { postMessageToExtension } from '../utils/vscode';
import { ChevronDown, Check, RefreshCw } from 'lucide-react';

export interface VaultHistoryEntry {
    key: string;
    createdAt: number;
    dir: string;
}

interface VaultSelectorProps {
    focusableVaults: VaultHistoryEntry[];
    focusedVault: string | null;
    isRefreshing?: boolean;
    onRefresh?: () => void;
}

const VaultSelector = ({ focusableVaults, focusedVault, isRefreshing = false, onRefresh }: VaultSelectorProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const selectorRef = useRef<HTMLDivElement>(null);
    
    console.log('focusableVaults', focusableVaults);
    console.log('focusedVault', focusedVault);

    // Format time to be user-friendly
    const formatTimeAgo = (timestamp: number) => {
        const now = Date.now();
        const diffMs = now - timestamp;
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
    const handleVaultSelect = (vaultKey: string) => {
        postMessageToExtension({
            command: 'focusVault',
            vaultSecretKey: vaultKey
        });
        setIsOpen(false);
    };

    const toggleDropdown = () => {
        if (focusableVaults.length > 0) {
            setIsOpen(!isOpen);
        }
    };

    // Find the focused vault entry to get its timestamp
    const focusedVaultEntry = focusableVaults.find(vault => vault.key === focusedVault);

    return (
        <div 
            ref={selectorRef}
            className="relative text-[var(--fg-0)]"
        >
            <div className="flex items-center justify-between gap-2">
                <div 
                    onClick={toggleDropdown}
                    className={`flex flex-1 items-center justify-between p-2 cursor-pointer rounded-md bg-[var(--bg-0)] ${focusableVaults.length > 0 ? 'hover:bg-[var(--accent)]' : 'opacity-70'}`}
                >
                    <div className="flex flex-col">
                        <div className="text-sm font-semibold">
                            {focusedVaultEntry 
                                ? formatTimeAgo(focusedVaultEntry.createdAt)
                                : (focusedVault ? 'No run selected' : 'No runs available')}
                        </div>
                        <div className="text-xs text-[var(--fg-1)]">
                            in {focusedVaultEntry?.dir}
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
                    className="p-2 h-full flex items-center justify-center rounded-md hover:bg-[var(--bg-0)]">
                    <RefreshCw 
                        size={16} 
                        className={`${isRefreshing ? 'animate-spin' : ''}`} 
                    />
                </button>
            </div>

            {isOpen && focusableVaults.length > 0 && (
                <div className="absolute w-full bg-[var(--bg-2)] rounded-b-md shadow-lg z-30">
                    <ul className="py-1 max-h-[40vh] overflow-y-auto">
                        {focusableVaults.map((vault) => (
                            <li 
                                key={vault.key}
                                onClick={() => handleVaultSelect(vault.key)}
                                className={`flex items-center justify-between px-3 py-2 text-sm cursor-pointer hover:bg-[var(--bg-0)] ${vault.key === focusedVault ? 'bg-[var(--accent)]' : ''}`}
                            >
                                <div className="flex flex-col">
                                    <div className="text-sm font-semibold">
                                        {formatTimeAgo(vault.createdAt)}
                                    </div>
                                    <div className="text-xs text-[var(--fg-1)]">
                                        in {vault.dir}
                                    </div>
                                </div>
                                {vault.key === focusedVault && <Check size={16} />}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default VaultSelector;
