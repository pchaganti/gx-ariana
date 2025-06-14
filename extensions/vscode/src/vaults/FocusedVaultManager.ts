import { LightTrace } from "../bindings/LightTrace";
import { ConstructionTraceTree } from "../bindings/ConstructionTraceTree";
import { WebSocket, MessageEvent as WsMessageEvent, ErrorEvent as WsErrorEvent, CloseEvent as WsCloseEvent } from "ws";
import { StoredVaultData, VaultsManager } from "./VaultsManager";
import * as vscode from 'vscode';
import { getConfig } from "../config";
import { randomUUID } from 'crypto';
import { fetchFullTraces } from "../services/ApiClient";
import { Trace } from "../bindings/Trace";

export class FocusedVaultManager {
    private focusedVault: FocusedVault | null = null;
    private vaultKeyPollingInterval: NodeJS.Timeout | null = null;
    private vaultsManager: VaultsManager;
    private focusedVaultSubscribers: Map<string, (vault: FocusedVault | null) => void> = new Map();
    private batchLightTracesSubscribers: Map<string, (traces: LightTrace[]) => void> = new Map();

    constructor(vaultsManager: VaultsManager) {
        this.vaultsManager = vaultsManager;
        this.startVaultKeyMonitoring();
    }

    public getFocusedVaultLightTraces(): LightTrace[] {
        return this.focusedVault?.constructionTraceTree?.traces.items ?? [];
    }

    public getFocusedVaultConstructionTraceTree(): ConstructionTraceTree | null {
        return this.focusedVault?.constructionTraceTree ?? null;
    }

    public async getFocusedVaultFullTraces(traceIds: string[]): Promise<Trace[] | null> {
        console.log("Call to getFocusedVaultFullTraces with ", this.focusedVault);
        return this.focusedVault?.getFullTraces(traceIds) ?? null;
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

    public subscribeToLightTracesBatch(onChange: (traces: LightTrace[]) => void): () => void {
        const uuid = randomUUID();
        this.batchLightTracesSubscribers.set(uuid, onChange);
        return () => {
            this.batchLightTracesSubscribers.delete(uuid);
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

        let newestVaultDataInWorkspaces: { vault: StoredVaultData; status: "new" | "existing" } | null = null;
        let latestTimestampInWorkspaces = 0;

        for (const folder of workspaceFolders) {
            const vaultDataInFolder = await this.vaultsManager.getCurrentLocalVaultKey(folder.uri.fsPath);
            if (vaultDataInFolder && vaultDataInFolder.vault.created_at > latestTimestampInWorkspaces) {
                newestVaultDataInWorkspaces = vaultDataInFolder;
                latestTimestampInWorkspaces = vaultDataInFolder.vault.created_at;
            }
        }

        if (!newestVaultDataInWorkspaces) {
            // No vault found in any of the workspace folders
            if (this.focusedVault) {
                // A vault was previously focused, but now none are found in any workspace folder. Clear it.
                console.log("Previously focused vault no longer found in any workspace. Clearing focus.");
                this.focusedVault.closeConnection();
                this.focusedVault = null;
                this.focusedVaultSubscribers.forEach(subscriber => subscriber(null));
            }
            // If no vault was focused and none are found, no action is needed.
        }
    }

    public switchFocusedVault(newVaultData: StoredVaultData | null, retries: number = 0) {
        if (this.focusedVault?.vaultData.secret_key !== newVaultData?.secret_key) {
            console.log('Switching focused vault to: ' + newVaultData?.secret_key);
            this.focusedVault?.closeConnection();
            if (newVaultData) {
                this.focusedVault = new FocusedVault(newVaultData, (traces) => {
                    this.batchLightTracesSubscribers.forEach(subscriber => subscriber(traces));
                }, () => {}, () => {
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
            } else {
                this.focusedVault?.closeConnection();
                this.focusedVault = null;
                this.focusedVaultSubscribers.forEach(subscriber => subscriber(null));
            }
            this.focusedVaultSubscribers.forEach(subscriber => subscriber(this.focusedVault));
        }
    }
}

class FocusedVault {
    public vaultData: StoredVaultData;
    public constructionTraceTree: ConstructionTraceTree | null = null;
    public wsConnection: WebSocket | null = null;
    private onLightTracesBatch: (traces: LightTrace[]) => void;
    private onCloseCallback: () => void;
    private onErrorCallback: () => void;
    private pendingTraces: LightTrace[] = [];
    private throttleTimeout: NodeJS.Timeout | null = null;
    private throttleInterval: number = 800;

    constructor(vaultData: StoredVaultData, onLightTracesBatch: (traces: LightTrace[]) => void, onCloseCallback: () => void, onErrorCallback: () => void) {
        this.vaultData = vaultData;
        this.onLightTracesBatch = onLightTracesBatch;
        this.onCloseCallback = onCloseCallback;
        this.onErrorCallback = onErrorCallback;
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

    public getFullTraces(traceIds: string[]): Promise<Trace[] | null> {
        console.log("Call to getFullTraces");
        return fetchFullTraces(this.vaultData.secret_key, traceIds);
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
    
        this.wsConnection.onmessage = async (event: WsMessageEvent) => { // Use onmessage and WsMessageEvent, make async
            const data = event.data;
            console.log(`Received WebSocket message for ${vaultSecretKey}...`);
            try {
                // Assuming data is string. If binary, need Buffer.from(data).toString()
                const messageString = (typeof data === 'string') ? data : Buffer.from(data as ArrayBuffer).toString('utf-8');
                const tree: ConstructionTraceTree = JSON.parse(messageString);
                console.log('tree', tree);
                
                const newLightTraces: LightTrace[] = tree.traces.items;

                console.log('newLightTraces', newLightTraces);

                if (newLightTraces.length === 0) {
                    console.log(`Received empty trace batch for ${vaultSecretKey}, nothing to do.`);
                    return;
                }

                tree.traces.items = [...this.constructionTraceTree?.traces.items ?? [], ...newLightTraces];
                this.constructionTraceTree = tree;

                if (isFirstMessageBatch) {
                    console.log(`Received ${newLightTraces.length} initial full traces for ${vaultSecretKey} (from ${newLightTraces.length} light traces)`);
                    this.sendTracesImmediately(newLightTraces); 
                    isFirstMessageBatch = false;
                } else {
                    console.log(`Received ${newLightTraces.length} new full traces for ${vaultSecretKey} (from ${newLightTraces.length} light traces)`);
                    this.queueLightTracesForSending(newLightTraces);
                }
            } catch (error) {
                console.error(`Error processing WebSocket message for ${vaultSecretKey}:`, error);
            }
        };
    
        this.wsConnection.onerror = (errorEvent: WsErrorEvent) => { // Use onerror and WsErrorEvent
            console.error(`WebSocket error for ${vaultSecretKey}:`, errorEvent);
            this.wsConnection = null;
            this.onErrorCallback();
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
    private queueLightTracesForSending(traces: LightTrace[]): void {
        this.pendingTraces.push(...traces);
        if (!this.throttleTimeout) {
            this.throttleTimeout = setTimeout(() => {
                this.sendPendingTraces();
                this.throttleTimeout = null;
            }, this.throttleInterval);
        }
    }

    private sendPendingTraces(): void {
        if (this.pendingTraces.length > 0) {
            this.onLightTracesBatch([...this.pendingTraces]);
            this.pendingTraces = [];
        }
    }

    private sendTracesImmediately(traces: LightTrace[]): void {
        if (traces.length > 0) {
            this.onLightTracesBatch(traces);
        }
    }
}
