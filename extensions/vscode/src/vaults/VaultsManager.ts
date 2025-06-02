import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { VaultPublicData } from '../bindings/VaultPublicData'; // Added import
import { getConfig } from '../config';

// Define the structure for storing vault data (combining server data with local dir)
export type StoredVaultData = VaultPublicData & {
    dir: string;
};

// Old interface - can be removed if no longer used internally during discovery phase
export interface VaultHistoryEntry {
    key: string;
    createdAt: number; // local discovery/file timestamp
    dir: string;
}

export class VaultsManager {
    private static readonly VAULT_DATA_MAP_STORAGE_KEY = 'ariana.vaultsDataMap';
    private globalState: vscode.Memento;

    private getServerBaseUrl(): string {
        return getConfig().apiUrl;
    }

    private readonly _onDidUpdateVaultData = new vscode.EventEmitter<StoredVaultData>();
    public readonly onDidUpdateVaultData = this._onDidUpdateVaultData.event;

    constructor(globalState: vscode.Memento) {
        this.globalState = globalState;
    }

    /**
     * Fetches VaultPublicData from the server for given keys.
     */
    private async fetchVaultPublicDataFromServer(keys: string[]): Promise<Array<VaultPublicData | null>> {
        if (keys.length === 0) {
            return [];
        }
        const serverUrl = this.getServerBaseUrl();
        try {
            const response = await fetch(`${serverUrl}/vaults/get-from-secret`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(keys),
            });

            if (!response.ok) {
                const errorBody = await response.text().catch(() => "Could not read error body");
                console.error(`Error fetching vault data from server: ${response.status} ${response.statusText}. Response: ${errorBody}`);
                return keys.map(() => null);
            }
            const data = await response.json() as Array<VaultPublicData | null>;
            return data;
        } catch (error) {
            console.error('Network or other error fetching vault data:', error);
            return keys.map(() => null);
        }
    }
    
    /**
     * Retrieves all stored vault data, sorts by server-side creation date (most recent first).
     */
    public getVaultHistory(): StoredVaultData[] {
        const vaultsMap = this.globalState.get<Record<string, StoredVaultData>>(VaultsManager.VAULT_DATA_MAP_STORAGE_KEY, {});
        const vaultsArray = Object.values(vaultsMap);
        vaultsArray.sort((a, b) => b.created_at - a.created_at);
        return vaultsArray;
    }

    /**
     * Processes a locally discovered vault: fetches its full data from the server,
     * stores it, and fires an event.
     * @param secretKey The vault's secret key.
     * @param dir The local directory where the vault's .ariana folder resides.
     * @returns The StoredVaultData if successful, otherwise null.
     */
    public async processAndStoreVault(secretKey: string, dir: string): Promise<StoredVaultData | null> {
        const serverDataArray = await this.fetchVaultPublicDataFromServer([secretKey]);
        const serverData = serverDataArray[0];

        if (serverData) {
            // Ensure secret_key from server matches the one discovered, though API guarantees this for non-null returns
            if (serverData.secret_key !== secretKey) {
                console.warn(`Mismatch in secret key from server for ${secretKey}. Server returned ${serverData.secret_key}. Skipping update.`);
                return null;
            }

            const storedVaultData: StoredVaultData = {
                ...serverData,
                dir: dir,
            };

            const vaultsMap = this.globalState.get<Record<string, StoredVaultData>>(VaultsManager.VAULT_DATA_MAP_STORAGE_KEY, {});
            vaultsMap[secretKey] = storedVaultData;
            await this.globalState.update(VaultsManager.VAULT_DATA_MAP_STORAGE_KEY, vaultsMap);
            
            this._onDidUpdateVaultData.fire(storedVaultData);
            console.log(`Updated data for vault ${secretKey} from server.`);
            return storedVaultData;
        } else {
            console.warn(`Could not fetch data from server for vault ${secretKey}. It might not exist on the server or there was an error.`);
            // Optional: remove from map if it's considered stale or invalid
            // const vaultsMap = this.globalState.get<Record<string, StoredVaultData>>(VaultsManager.VAULT_DATA_MAP_STORAGE_KEY, {});
            // if (vaultsMap[secretKey]) {
            //     delete vaultsMap[secretKey];
            //     await this.globalState.update(VaultsManager.VAULT_DATA_MAP_STORAGE_KEY, vaultsMap);
            //     console.log(`Removed potentially stale/invalid vault ${secretKey} from local cache.`);
            // }
        }
        return null;
    }

    /**
     * Finds the nearest .ariana directory, reads the .vault_secret_key,
     * fetches full vault data from the server, and stores it.
     * Returns the StoredVaultData for the most relevant vault (most recent by server time).
     */
    public async getCurrentLocalVaultKey(filePath: string): Promise<StoredVaultData | null> {
        try {
            const arianaDirs = await this.findDirsContainingAriana(filePath);
            if (arianaDirs.length === 0) {
                return null;
            }

            const processedVaults: StoredVaultData[] = [];

            for (const dir of arianaDirs) {
                const vaultKeyPath = path.join(dir, '.ariana', '.vault_secret_key');
                try {
                    const keyContent = await fs.readFile(vaultKeyPath, 'utf-8');
                    const secretKey = keyContent.split('\n')[0]?.trim(); // Corrected split character
                    
                    if (secretKey) {
                        const storedData = await this.processAndStoreVault(secretKey, dir);
                        if (storedData) {
                            processedVaults.push(storedData);
                        }
                    }
                } catch (error) {
                    if (error instanceof Error && 'code' in error && error.code !== 'ENOENT') {
                        console.error('Error reading vault key file:', vaultKeyPath, error);
                    } // else - file not found is expected, or .ariana dir might exist without key
                }
            }
            
            if (processedVaults.length === 0) {
                return null;
            }
            
            processedVaults.sort((a, b) => b.created_at - a.created_at);
            return processedVaults[0]; 

        } catch (error) {
            console.error('Error in getCurrentLocalVaultKey:', error);
            return null;
        }
    }

    private async findDirsContainingAriana(filePath: string): Promise<string[]> {
        // Start with the directory of the given file path
        let startDir = path.dirname(filePath);
        try {
            const stats = await fs.stat(filePath);
            if (stats.isDirectory()) {
                startDir = filePath;
            }
        } catch (error) {
            console.warn(`Could not stat path ${filePath}, proceeding with path.dirname`);
        }
        
        const results: string[] = [];
        const queue: { dir: string; depth: number }[] = [{ dir: startDir, depth: 0 }];
        const visited = new Set<string>();
        let directoriesExplored = 0;
        
        while (queue.length > 0 && directoriesExplored < 5000) {
            const { dir, depth } = queue.shift()!;
            
            // Skip if we've visited this directory before or if we've reached max depth
            if (visited.has(dir) || depth > 10) {
                continue;
            }
            
            visited.add(dir);
            directoriesExplored++;
            
            // Check if current directory contains .ariana
            const arianaPath = path.join(dir, '.ariana');
            try {
                const arianaStats = await fs.stat(arianaPath);
                if (arianaStats.isDirectory()) {
                    // Check if .vault_secret_key exists within .ariana
                    const keyPath = path.join(arianaPath, '.vault_secret_key');
                    try {
                        await fs.access(keyPath, fs.constants.F_OK);
                        results.push(dir); // Found valid .ariana directory
                    } catch {
                        // .ariana exists but no key file
                    }
                }
            } catch {
                // .ariana doesn't exist in this directory, continue search
            }
            
            // Add subdirectories to the queue
            try {
                const entries = await fs.readdir(dir, { withFileTypes: true });
                for (const entry of entries) {
                    if (entry.isDirectory() && !entry.name.startsWith('.')) {
                        const subdirPath = path.join(dir, entry.name);
                        queue.push({ dir: subdirPath, depth: depth + 1 });
                    }
                }
            } catch (error) {
                console.warn(`Could not read directory ${dir}:`, error);
            }
        }
        
        return results;
    }
}