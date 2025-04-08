import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';

// Define the structure for vault history entries
export interface VaultHistoryEntry {
    key: string;
    createdAt: number;
    dir: string;
}

export class VaultsManager {
    // private static readonly STORAGE_KEY = 'ariana.vaultSecrets'; // Original key, maybe unused now?
    private static readonly VAULT_HISTORY_STORAGE_KEY = 'ariana.vaultHistory'; // A.1
    private globalState: vscode.Memento;

    private readonly _onDidAddVault = new vscode.EventEmitter<VaultHistoryEntry>();
    public readonly onDidAddVault = this._onDidAddVault.event;

    constructor(globalState: vscode.Memento) {
        this.globalState = globalState;
    }

    /**
     * Finds the nearest .ariana directory and reads the .vault_secret_key.
     * Does NOT store the key or timestamp itself.
     */
    public async getCurrentLocalVaultKey(filePath: string): Promise<VaultHistoryEntry | null> {
        try {
            const arianaDirs = await this.findDirsContainingAriana(filePath);
            if (arianaDirs.length === 0) {
                return null;
            }

            const vaultEntries = await Promise.all(arianaDirs.map(async (dir) => {
                const vaultKeyPath = path.join(dir, '.ariana', '.vault_secret_key');
                try {
                    console.log("getting vault key from", vaultKeyPath);
                    const keyContent = await fs.readFile(vaultKeyPath, 'utf-8');
                    const secretKey = keyContent.split('\n')[0]?.trim(); // Get first line and trim whitespace
                    
                    if (secretKey) {
                        // Get file stats to use file creation time as timestamp
                        const stats = await fs.stat(vaultKeyPath);
                        const createdAt = stats.birthtime.getTime();
                        this.addVaultToHistory(secretKey, createdAt, dir);
                        
                        return { key: secretKey, createdAt, dir };
                    }
                } catch (error) {
                    if (error instanceof Error && 'code' in error && error.code !== 'ENOENT') {
                        console.error('Error reading vault key:', error);
                    } // else - file not found is expected
                }
                return null;
            }));

            // Filter out nulls and get the most recent vault
            const validEntries = vaultEntries.filter(entry => entry !== null) as VaultHistoryEntry[];
            if (validEntries.length === 0) {
                return null;
            }
            
            // Sort by creation time (most recent first)
            validEntries.sort((a, b) => b.createdAt - a.createdAt);
            return validEntries[0];
        } catch (error) {
            console.error('Error finding .ariana directory:', error);
            return null;
        }
    }

    /**
     * Adds a vault key and timestamp to the persistent history if it doesn't exist.
     * Fires the onDidAddVault event upon successful addition.
     */
    private async addVaultToHistory(key: string, createdAt: number, dir: string): Promise<void> {
        const history = this.getVaultHistory(); // Gets current sorted history
        const exists = history.some(entry => entry.key === key);

        if (!exists) {
            console.log(`Adding new vault to history: ${key} (Created at: ${new Date(createdAt).toISOString()})`);
            const newHistoryEntry: VaultHistoryEntry = { key, createdAt, dir };
            const updatedHistory = [...history, newHistoryEntry];

            // Sort descending (most recent first)
            updatedHistory.sort((a, b) => b.createdAt - a.createdAt);

            await this.globalState.update(VaultsManager.VAULT_HISTORY_STORAGE_KEY, updatedHistory);
            this._onDidAddVault.fire(newHistoryEntry); // Fire event with the added entry
        }
    }

    /**
     * Retrieves all stored vault keys and their creation timestamps,
     * sorted from most recent to least recent.
     */
    public getVaultHistory(): VaultHistoryEntry[] {
        // Retrieve, default to empty array, and ensure sort order
        return this.globalState.get<VaultHistoryEntry[]>(VaultsManager.VAULT_HISTORY_STORAGE_KEY, [])
               .sort((a, b) => b.createdAt - a.createdAt);
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