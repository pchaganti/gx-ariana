import { Trace } from "../bindings/Trace";
import { WebSocket, MessageEvent as WsMessageEvent, ErrorEvent as WsErrorEvent, CloseEvent as WsCloseEvent } from "ws";
import { StoredVaultData, VaultsManager } from "./VaultsManager";
import * as vscode from 'vscode';
import { getConfig } from "../config";
import { randomUUID } from 'crypto';

export class FocusedVaultManager {
    private focusedVault: FocusedVault | null = null;
    private lastVaultFoundTimestamp: number = 0;
    private vaultKeyPollingInterval: NodeJS.Timeout | null = null;
    private vaultsManager: VaultsManager;
    private focusedVaultSubscribers: Map<string, (vault: FocusedVault | null) => void> = new Map();
    private batchTraceSubscribers: Map<string, (trace: Trace[]) => void> = new Map();

    constructor(vaultsManager: VaultsManager) {
        this.vaultsManager = vaultsManager;
        this.startVaultKeyMonitoring();
    }

    public getFocusedVaultTraces(): Trace[] {
        return this.focusedVault?.tracesData ?? [];
    }

    public getFocusedVault(): FocusedVault | null {
        return this.focusedVault;
    }

    public subscribeToFocusedVaultChange(onChange: (vault: FocusedVault | null) => void): () => void {
        const uuid = randomUUID();
        this.focusedVaultSubscribers.set(uuid, onChange);
        return () => {
            this.focusedVaultSubscribers.delete(uuid);
        };
    }

    public subscribeToBatchTrace(onChange: (trace: Trace[]) => void): () => void {
        const uuid = randomUUID();
        this.batchTraceSubscribers.set(uuid, onChange);
        return () => {
            this.batchTraceSubscribers.delete(uuid);
        };
    }

    public startVaultKeyMonitoring() {
        console.log('Starting vault key monitoring...');
        this.dispose();
        this.checkVaultKeyAndUpdateConnection();
        this.vaultKeyPollingInterval = setInterval(() => this.checkVaultKeyAndUpdateConnection(), 5000);
    }
    
    public dispose() {
        console.log('Stopping vault key monitoring...');
        if (this.vaultKeyPollingInterval) {
            clearInterval(this.vaultKeyPollingInterval);
            this.vaultKeyPollingInterval = null;
        }
        this.focusedVault?.closeConnection();
        this.focusedVault = null; 
    }

    private async checkVaultKeyAndUpdateConnection() {
        console.log('Checking vault key for focused manager...');

        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            return;
        }

        let newestVaultDataInWorkspaces: StoredVaultData | null = null;
        let latestTimestampInWorkspaces = 0;

        for (const folder of workspaceFolders) {
            const vaultDataInFolder = await this.vaultsManager.getCurrentLocalVaultKey(folder.uri.fsPath);
            if (vaultDataInFolder && vaultDataInFolder.created_at > latestTimestampInWorkspaces) {
                newestVaultDataInWorkspaces = vaultDataInFolder;
                latestTimestampInWorkspaces = vaultDataInFolder.created_at;
            }
        }

        if (newestVaultDataInWorkspaces) {
            // A vault (the newest one across all workspaces) was found
            if (newestVaultDataInWorkspaces.created_at > this.lastVaultFoundTimestamp) {
                // This vault is newer than any previously focused vault
                console.log(`Newer vault found across workspaces: ${newestVaultDataInWorkspaces.secret_key}, created_at: ${newestVaultDataInWorkspaces.created_at}`);
                this.lastVaultFoundTimestamp = newestVaultDataInWorkspaces.created_at;
                this.switchFocusedVault(newestVaultDataInWorkspaces);
            } else if (!this.focusedVault || (this.focusedVault && this.focusedVault.vaultData.secret_key !== newestVaultDataInWorkspaces.secret_key)) {
                // No vault currently focused, or the current focused vault is different from the newest one found in workspaces.
                // This handles re-focusing (e.g., after VSCode restart) or switching if a different vault is now the newest available.
                console.log(`Re-focusing or initializing vault to newest found in workspaces: ${newestVaultDataInWorkspaces.secret_key}`);
                this.lastVaultFoundTimestamp = newestVaultDataInWorkspaces.created_at; // Ensure timestamp is up-to-date
                this.switchFocusedVault(newestVaultDataInWorkspaces);
            }
            // If the newestVaultDataInWorkspaces is the same as this.focusedVault and not newer, no action is needed.
        } else {
            // No vault found in any of the workspace folders
            if (this.focusedVault) {
                // A vault was previously focused, but now none are found in any workspace folder. Clear it.
                console.log("Previously focused vault no longer found in any workspace. Clearing focus.");
                this.focusedVault.closeConnection();
                this.focusedVault = null;
                this.lastVaultFoundTimestamp = 0;
                this.focusedVaultSubscribers.forEach(subscriber => subscriber(null));
            }
            // If no vault was focused and none are found, no action is needed.
        }
    }

    public switchFocusedVault(newVaultData: StoredVaultData, retries: number = 0) {
        if (this.focusedVault?.vaultData.secret_key !== newVaultData.secret_key) {
            console.log('Switching focused vault to: ' + newVaultData.secret_key);
            this.focusedVault?.closeConnection();
            this.focusedVault = new FocusedVault(newVaultData, (traces) => {
                this.batchTraceSubscribers.forEach(subscriber => subscriber(traces));
            }, () => {
                console.log('WebSocket connection for vault ' + newVaultData.secret_key + ' failed or closed, attempting retry...');
                setTimeout(() => {
                    // Only retry if this vault is still supposed to be the focused one
                    if (this.focusedVault?.vaultData.secret_key === newVaultData.secret_key) {
                        console.log('Retrying connection for ' + newVaultData.secret_key);
                        // Create a new FocusedVault instance, which will trigger a new connection attempt
                        this.switchFocusedVault(newVaultData, retries + 1); 
                    }
                }, Math.min(30000, Math.pow(2, retries) * 1000)); // Exponential backoff, max 30s
            });
        }
        // Notify subscribers even if it's the same vault, in case the instance was recreated (e.g., after retry)
        this.focusedVaultSubscribers.forEach(subscriber => subscriber(this.focusedVault));
    }
}

class FocusedVault {
    public vaultData: StoredVaultData;
    public tracesData: Trace[] = [];
    public wsConnection: WebSocket | null = null;
    private onBatchTrace: (trace: Trace[]) => void;
    private onCloseCallback: () => void;
    private pendingTraces: Trace[] = [];
    private throttleTimeout: NodeJS.Timeout | null = null;
    private throttleInterval: number = 800;

    constructor(vaultData: StoredVaultData, onBatchTrace: (trace: Trace[]) => void, onCloseCallback: () => void) {
        this.vaultData = vaultData;
        this.onBatchTrace = onBatchTrace;
        this.onCloseCallback = onCloseCallback;
        this.connectToTraceWebSocket();
    }

    public closeConnection() {
        if (this.wsConnection) {
            this.wsConnection.onclose = null; // Remove listener to prevent retry logic if manually closed
            this.wsConnection.close();
            this.wsConnection = null;
            console.log(`Closed WebSocket connection for vault ${this.vaultData.secret_key}`);
        }
    }

    private connectToTraceWebSocket() {
        const vaultSecretKey = this.vaultData.secret_key;
        console.log(`Connecting to WebSocket for vault: ${vaultSecretKey}`);

        const wsUrl = getConfig().apiUrl.replace(/^http/, 'ws');
        const fullWsUrl = `${wsUrl}/vaults/traces/${vaultSecretKey}/stream`;
        console.log(`Connecting to WebSocket at ${fullWsUrl}`);
    
        this.wsConnection = new WebSocket(fullWsUrl);
    
        this.wsConnection.onopen = () => { // Use onopen assignment
            console.log(`WebSocket connection established for ${vaultSecretKey}`);
        };
    
        let isFirstMessageBatch = true;
    
        this.wsConnection.onmessage = (event: WsMessageEvent) => { // Use onmessage and WsMessageEvent
            const data = event.data;
            console.log(`Received WebSocket message for ${vaultSecretKey}...`);
            try {
                // Assuming data is string. If binary, need Buffer.from(data).toString()
                const messageString = (typeof data === 'string') ? data : Buffer.from(data as ArrayBuffer).toString('utf-8');
                const parsedData: Trace | Trace[] = JSON.parse(messageString);
                
                const newTraces: Trace[] = Array.isArray(parsedData) ? parsedData : [parsedData];

                if (isFirstMessageBatch) {
                    console.log(`Received ${newTraces.length} initial traces from WebSocket for ${vaultSecretKey}`);
                    this.tracesData = newTraces;
                    this.sendTracesImmediately(newTraces); 
                    isFirstMessageBatch = false;
                } else {
                    console.log(`Received ${newTraces.length} new traces from WebSocket for ${vaultSecretKey}`);
                    this.tracesData.push(...newTraces);
                    this.queueTracesForSending(newTraces);
                }
            } catch (error) {
                console.error(`Error processing WebSocket message for ${vaultSecretKey}:`, error);
            }
        };
    
        this.wsConnection.onerror = (errorEvent: WsErrorEvent) => { // Use onerror and WsErrorEvent
            console.error(`WebSocket error for ${vaultSecretKey}:`, errorEvent);
        };
    
        this.wsConnection.onclose = (closeEvent: WsCloseEvent) => { // Use onclose and WsCloseEvent
            console.log(`WebSocket connection closed for ${vaultSecretKey}: ${closeEvent.code} ${closeEvent.reason}`);
            this.wsConnection = null;
            this.onCloseCallback(); // Trigger the retry/cleanup logic passed from FocusedVaultManager
        };
    }

    /**
     * Queues traces for throttled sending
     * @param traces The traces to queue
     */
    private queueTracesForSending(traces: Trace[]): void {
        this.pendingTraces.push(...traces);
        if (!this.throttleTimeout) {
            this.throttleTimeout = setTimeout(() => {
                this.sendPendingTraces();
                this.throttleTimeout = null; // Clear timeout after execution
            }, this.throttleInterval);
        }
    }

    private sendPendingTraces(): void {
        if (this.pendingTraces.length > 0) {
            this.onBatchTrace([...this.pendingTraces]);
            this.pendingTraces = []; // Clear the queue
        }
    }

    private sendTracesImmediately(traces: Trace[]): void {
        if (traces.length > 0) {
            this.onBatchTrace(traces);
        }
    }
}
