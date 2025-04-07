import { Trace } from "../bindings/Trace";
import { WebSocket } from "ws";
import { VaultHistoryEntry, VaultsManager } from "./VaultsManager";
import * as vscode from 'vscode';
import { getConfig } from "../config";

export class FocusedVaultManager {
    private focusedVault: FocusedVault | null = null;
    private vaultKeyPollingInterval: NodeJS.Timeout | null = null;
    private vaultsManager: VaultsManager | null = null;
    private focusedVaultSubscribers: Map<string, (vault: FocusedVault | null) => void> = new Map();
    private singleTraceSubscribers: Map<string, (trace: Trace) => void> = new Map();
    private batchTraceSubscribers: Map<string, (trace: Trace[]) => void> = new Map();

    constructor(vaultsManager: VaultsManager) {
        this.vaultsManager = vaultsManager;
        this.startVaultKeyMonitoring();
    }

    public getFocusedVaultTraces(): Trace[] {
        return this.focusedVault?.tracesData ?? [];
    }
    
    public subscribeToFocusedVaultChange(onChange: (vault: FocusedVault | null) => void): () => void {
        const uuid = crypto.randomUUID();
        this.focusedVaultSubscribers.set(uuid, onChange);
        return () => {
            this.focusedVaultSubscribers.delete(uuid);
        };
    }

    public subscribeToSingleTrace(onChange: (trace: Trace) => void): () => void {
        const uuid = crypto.randomUUID();
        this.singleTraceSubscribers.set(uuid, onChange);
        return () => {
            this.singleTraceSubscribers.delete(uuid);
        };
    }

    public subscribeToBatchTrace(onChange: (trace: Trace[]) => void): () => void {
        const uuid = crypto.randomUUID();
        this.batchTraceSubscribers.set(uuid, onChange);
        return () => {
            this.batchTraceSubscribers.delete(uuid);
        };
    }

    public startVaultKeyMonitoring() {
        console.log('Starting vault key monitoring...');
        // Stop existing monitoring if any
        this.dispose();
    
        // Check immediately and then at regular intervals
        this.checkVaultKeyAndUpdateConnection();
    
        this.vaultKeyPollingInterval = setInterval(() => this.checkVaultKeyAndUpdateConnection(), 5000); // Check every 5 seconds
    }
    
    public dispose() {
        console.log('Stopping vault key monitoring...');
        if (this.vaultKeyPollingInterval) {
            clearInterval(this.vaultKeyPollingInterval);
            this.vaultKeyPollingInterval = null;
        }
        this.focusedVault?.wsConnection?.close();
        this.focusedVault = null; 
    }

    private async checkVaultKeyAndUpdateConnection() {
        console.log('Checking vault key...');

        // Get all workspace folder URIs
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders) {
            // Map each workspace folder to its filesystem path
            const topLevelDirs = workspaceFolders.map(folder => folder.uri.fsPath);
        } else {
            return;
        }

        let vaults: (VaultHistoryEntry | null)[] = await Promise.all(workspaceFolders.map(async (folder) => {
            return this.vaultsManager?.getCurrentLocalVaultKey(folder.uri.fsPath) ?? null;
        }));
        vaults = vaults.filter((v) => v !== null);

        console.log("found vaults: ", vaults);

        // sort by recency
        vaults.sort((a, b) => {
            if (!a || !b) {
                return 0;
            }
            return b.createdAt - a.createdAt;
        });

        const mostRecentVault = vaults[0];
        if (mostRecentVault) {
            this.switchFocusedVault(mostRecentVault.key);
        }
    }

    private switchFocusedVault(newFocusKey: string, retries: number = 0) {
        if (this.focusedVault && this.focusedVault.key !== newFocusKey) {
            this.focusedVault.wsConnection?.close();
            this.focusedVault.wsConnection = null;
            this.focusedVault = new FocusedVault(newFocusKey, (trace) => {
                this.singleTraceSubscribers.forEach(subscriber => subscriber(trace));
            }, (traces) => {
                this.batchTraceSubscribers.forEach(subscriber => subscriber(traces));
            }, () => {
                setTimeout(() => {
                    if (this.focusedVault?.key === newFocusKey) {
                        this.switchFocusedVault(newFocusKey, retries + 1);
                    }
                }, Math.pow(2, (retries + 1)) + 100);
            });
        }
    }
}

class FocusedVault {
    public key: string;
    public tracesData: Trace[] = [];
    public wsConnection: WebSocket | null = null;
    private onSingleTrace: (trace: Trace) => void;
    private onBatchTrace: (trace: Trace[]) => void;
    private onClose: () => void;

    constructor(key: string, onSingleTrace: (trace: Trace) => void, onBatchTrace: (trace: Trace[]) => void, onClose: () => void) {
        this.key = key;
        this.onSingleTrace = onSingleTrace;
        this.onBatchTrace = onBatchTrace;
        this.onClose = onClose;
        this.connectToTraceWebSocket(key);
    }

    private connectToTraceWebSocket(vaultSecretKey: string) {
        console.log('Connecting to WebSocket...');

    
        const wsUrl = getConfig().apiUrl.replace(/^http/, 'ws');
        const fullWsUrl = `${wsUrl}/vaults/traces/${vaultSecretKey}/stream`;
        console.log(`Connecting to WebSocket at ${fullWsUrl}`);
    
        this.wsConnection = new WebSocket(fullWsUrl);
    
        this.wsConnection.on('open', () => {
            console.log('WebSocket connection established');
        });
    
        let isFirst = true;
    
        this.wsConnection.on('message', (data: Buffer) => {
            console.log('Received WebSocket message...');
            try {
                const parsedData: Trace | Trace[] = JSON.parse(data.toString());
                if (Array.isArray(parsedData)) {
                    // Initial batch of traces
                    if (isFirst) {
                        console.log(`Received ${parsedData.length} initial traces from WebSocket`);
                        this.tracesData = parsedData;
                    } else {
                        console.log(`Received ${parsedData.length} new traces from WebSocket`);
                        parsedData.forEach(pd => this.tracesData.push(pd));
                    }
                    this.onBatchTrace(parsedData);
                } else {
                    // Single new trace
                    console.log('Received exactly one new trace from WebSocket');
                    this.tracesData.push(parsedData);
                    this.onSingleTrace(parsedData);
                }
                isFirst = false;
            } catch (error) {
                console.error('Error processing WebSocket message:', error);
            }
        });
    
        this.wsConnection.on('error', (error: Error) => {
            console.error('WebSocket error:', error);
        });
    
        this.wsConnection.on('close', (code: number, reason: string) => {
            console.log(`WebSocket connection closed: ${code} ${reason}`);
            this.wsConnection = null;
            this.onClose();
        });
    
    
        return this.wsConnection;
    }
}
