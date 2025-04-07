import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';

// Define the structure for vault history entries
export interface VaultHistoryEntry {
    key: string;
    createdAt: number; // Using number (milliseconds since epoch) for easier sorting
}

export class VaultsManager {
    // private static readonly STORAGE_KEY = 'ariana.vaultSecrets'; // Original key, maybe unused now?
    private static readonly VAULT_HISTORY_STORAGE_KEY = 'ariana.vaultHistory'; // A.1
    private static instance: VaultsManager;
    private globalState: vscode.Memento;

    // A.2: Event emitter for new vaults added to history
    private readonly _onDidAddVault = new vscode.EventEmitter<VaultHistoryEntry>();
    public readonly onDidAddVault = this._onDidAddVault.event;

    private constructor(context: vscode.ExtensionContext) {
        this.globalState = context.globalState;
    }

    public static initialize(context: vscode.ExtensionContext): VaultsManager {
        if (!VaultsManager.instance) {
            VaultsManager.instance = new VaultsManager(context);
        }
        return VaultsManager.instance;
    }

    public static getInstance(): VaultsManager {
        if (!VaultsManager.instance) {
            throw new Error('VaultsManager not initialized');
        }
        return VaultsManager.instance;
    }

    /**
     * Finds the nearest .ariana directory and reads the .vault_secret_key.
     * Does NOT store the key or timestamp itself.
     */
    public async getCurrentLocalVaultKey(filePath: string): Promise<{ key: string; vaultKeyPath: string } | null> {
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
                    return { key: secretKey, vaultKeyPath: vaultKeyPath };
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
     * Stores a vault key in history using its file path to get the timestamp.
     * A.1 & A.2 (Triggering storage and event)
     */
    public async storeVaultKey(key: string, vaultKeyPath: string): Promise<void> {
        try {
            const stats = await fs.stat(vaultKeyPath);
            const createdAt = stats.mtimeMs;
            await this.addVaultToHistory(key, createdAt);
        } catch (statError) {
            console.error(`Error getting stats for vault key file ${vaultKeyPath}:`, statError);
            // Decide whether to proceed without timestamp? No, timestamp is essential.
        }
    }

    /**
     * Adds a vault key and timestamp to the persistent history if it doesn't exist.
     * Fires the onDidAddVault event upon successful addition.
     */
    private async addVaultToHistory(key: string, createdAt: number): Promise<void> {
        const history = this.getVaultHistory(); // Gets current sorted history
        const exists = history.some(entry => entry.key === key && entry.createdAt === createdAt);

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
     * A.3
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