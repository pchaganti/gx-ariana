import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { getConfig } from '../config';
import { VaultPublicData } from '../bindings/VaultPublicData';
import { machineId } from './machine';

export class VaultManager {
    private static readonly STORAGE_KEY = 'ariana.vaultSecrets';
    private static instance: VaultManager;
    private secrets: Map<string, string>;
    private globalState: vscode.Memento;

    private constructor(context: vscode.ExtensionContext) {
        this.globalState = context.globalState;
        this.secrets = new Map(Object.entries(this.globalState.get(VaultManager.STORAGE_KEY, {})));
    }

    public static initialize(context: vscode.ExtensionContext): VaultManager {
        if (!VaultManager.instance) {
            VaultManager.instance = new VaultManager(context);
        }
        return VaultManager.instance;
    }

    public static getInstance(): VaultManager {
        if (!VaultManager.instance) {
            throw new Error('VaultManager not initialized');
        }
        return VaultManager.instance;
    }

    public async getVaultKey(filePath: string): Promise<string | null> {
        try {
            const arianaDir = await this.findNearestDirContainingAriana(filePath);
            if (!arianaDir) {
                return null;
            }

            const vaultKeyPath = path.join(arianaDir, '.ariana', '.vault_secret_key');
            try {
                const keyContent = await fs.readFile(vaultKeyPath, 'utf-8');
                // Get first line without the newline character
                const secretKey = keyContent.split('\n')[0];
                return secretKey;
            } catch (error) {
                console.error('Error reading vault key:', error);
                return null;
            }
        } catch (error) {
            console.error('Error finding vault key:', error);
            return null;
        }
    }

    public async createVault(apiUrl: string, filePath: string): Promise<string> {
        const projectRoot = await this.findNearestDirContainingAriana(filePath);
        if (!projectRoot) {
            throw new Error('No .ariana directory found in parent directories');
        }

        try {
            console.log(`${apiUrl}/unauthenticated/vaults/create`)
            const response = await fetch(`${apiUrl}/unauthenticated/vaults/create`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Machine-Hash': machineId // hashed unique machine identifier for anonymous telemetry
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to create vault: ${response.statusText}`);
            }

            const data: VaultPublicData = await response.json();
            const secretKey = data.secret_key;
            await this.setVaultKey(projectRoot, secretKey);
            return secretKey;
        } catch (error) {
            console.error('Failed to create vault:', error);
            throw new Error('Failed to create vault. Please check your internet connection and try again.');
        }
    }

    private async setVaultKey(projectRoot: string, secretKey: string): Promise<void> {
        const arianaDir = path.join(projectRoot, '.ariana');
        
        try {
            // Ensure the .ariana directory exists
            try {
                await fs.mkdir(arianaDir, { recursive: true });
            } catch (error) {
                console.error('Error creating .ariana directory:', error);
            }
            
            // Write the vault key to the .vault_secret_key file
            const vaultKeyPath = path.join(arianaDir, '.vault_secret_key');
            await fs.writeFile(vaultKeyPath, secretKey);
            
            // Also keep it in memory
            this.secrets.set(projectRoot, secretKey);
            await this.globalState.update(
                VaultManager.STORAGE_KEY, 
                Object.fromEntries(this.secrets)
            );
        } catch (error) {
            console.error('Error setting vault key:', error);
            throw new Error('Failed to save vault key');
        }
    }

    private async findNearestDirContainingAriana(filePath: string): Promise<string | null> {
        let currentDir = path.dirname(filePath);
        const root = path.parse(currentDir).root;

        while (currentDir !== root) {
            const arianaPath = path.join(currentDir, '.ariana');
            try {
                await fs.access(arianaPath);
                return currentDir;
            } catch {
                currentDir = path.dirname(currentDir);
            }
        }
        return null;
    }
}