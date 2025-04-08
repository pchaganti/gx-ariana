import { useState, useEffect, useRef } from 'react';
import { postMessageToExtension } from '../utils/vscode';
import { ChevronDown, Check } from 'lucide-react';

export interface VaultHistoryEntry {
    key: string;
    createdAt: number;
}

interface VaultSelectorProps {
    focusableVaults: VaultHistoryEntry[];
    focusedVault: string | null;
}

const VaultSelector = ({ focusableVaults, focusedVault }: VaultSelectorProps) => {
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
            <div 
                onClick={toggleDropdown}
                className={`flex items-center justify-between p-2 cursor-pointer rounded-md bg-[var(--bg-0)] ${focusableVaults.length > 0 ? 'hover:bg-[var(--accent)]' : 'opacity-70'}`}
            >
                <span className="text-sm font-medium">
                    {focusedVaultEntry 
                        ? formatTimeAgo(focusedVaultEntry.createdAt)
                        : (focusedVault ? 'No run selected' : 'No runs available')}
                </span>
                {focusableVaults.length > 0 && (
                    <ChevronDown 
                        size={16} 
                        className={`transition-transform ${isOpen ? 'transform rotate-180' : ''}`} 
                    />
                )}
            </div>

            {isOpen && focusableVaults.length > 0 && (
                <div className="absolute w-full bg-[var(--bg-2)] rounded-b-md shadow-lg z-30">
                    <ul className="py-1">
                        {focusableVaults.map((vault) => (
                            <li 
                                key={vault.key}
                                onClick={() => handleVaultSelect(vault.key)}
                                className={`flex items-center justify-between px-3 py-2 text-sm cursor-pointer hover:bg-[var(--bg-0)] ${vault.key === focusedVault ? 'bg-[var(--accent)]' : ''}`}
                            >
                                <span>{formatTimeAgo(vault.createdAt)}</span>
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
