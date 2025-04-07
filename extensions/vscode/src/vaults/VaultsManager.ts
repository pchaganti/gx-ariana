import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';

// Define the structure for vault history entries
export interface VaultHistoryEntry {
    key: string;
    createdAt: number;
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
            const arianaDir = await this.findNearestDirContainingAriana(filePath);
            if (!arianaDir) {
                return null;
            }

            const vaultKeyPath = path.join(arianaDir, '.ariana', '.vault_secret_key');
            try {
                const keyContent = await fs.readFile(vaultKeyPath, 'utf-8');
                const secretKey = keyContent.split('\n')[0]?.trim(); // Get first line and trim whitespace

                if (secretKey) {
                    // Get file stats to use file creation time as timestamp
                    const stats = await fs.stat(vaultKeyPath);
                    const createdAt = stats.birthtime.getTime();

                    this.addVaultToHistory(secretKey, createdAt);

                    return { key: secretKey, createdAt };
                } else {
                    console.warn(`Vault key file found but empty or invalid: ${vaultKeyPath}`);
                    return null;
                }
            } catch (error) {
                if (error instanceof Error && 'code' in error && error.code !== 'ENOENT') {
                    console.error('Error reading vault key:', error);
                } // else - file not found is expected
                return null;
            }
        } catch (error) {
            console.error('Error finding .ariana directory:', error);
            return null;
        }
    }

    /**
     * Adds a vault key and timestamp to the persistent history if it doesn't exist.
     * Fires the onDidAddVault event upon successful addition.
     */
    private async addVaultToHistory(key: string, createdAt: number): Promise<void> {
        const history = this.getVaultHistory(); // Gets current sorted history
        const exists = history.some(entry => entry.key === key);

        if (!exists) {
            console.log(`Adding new vault to history: ${key} (Created at: ${new Date(createdAt).toISOString()})`);
            const newHistoryEntry: VaultHistoryEntry = { key, createdAt };
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

    private async findNearestDirContainingAriana(filePath: string): Promise<string | null> {
        let currentDir = path.dirname(filePath);
        // Handle cases where filePath might be a directory itself or doesn't exist
        try {
            const stats = await fs.stat(currentDir);
            if (!stats.isDirectory()) {
                currentDir = path.dirname(currentDir);
            }
        } catch {
             // If filePath's directory doesn't exist, start from workspace root?
             // For now, let's assume filePath is valid enough to get a starting dirname.
             console.warn(`Could not stat directory containing ${filePath}, proceeding with path.dirname`);
        }

        const root = path.parse(currentDir).root;

        while (currentDir && currentDir !== root) {
            const arianaPath = path.join(currentDir, '.ariana');
            try {
                const stats = await fs.stat(arianaPath);
                if (stats.isDirectory()) {
                    // Check if .vault_secret_key exists within .ariana
                    const keyPath = path.join(arianaPath, '.vault_secret_key');
                    try {
                        await fs.access(keyPath, fs.constants.F_OK); // Check for existence
                        return currentDir; // Found .ariana dir containing the key file
                    } catch {
                        // .ariana exists, but no key file yet. Continue searching upwards?
                        // Let's assume for now that if .ariana exists, the key *should* be there.
                        // If not, we won't find it here. Continue up.
                    }
                }
            } catch {
                // .ariana directory doesn't exist at this level
            }
            // Move up one directory
            const parentDir = path.dirname(currentDir);
            if (parentDir === currentDir) { // Reached the top without finding it
                 break;
            }
            currentDir = parentDir;
        }
        return null; // Reached root or error without finding .ariana
    }
}