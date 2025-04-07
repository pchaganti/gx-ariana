import * as vscode from 'vscode';

export class HighlightingToggle {
    private toggled: boolean;
    private onToggleSubscribers: Map<string, (toggled: boolean) => void> = new Map();

    constructor() {
        this.toggled = false;
    }

    public subscribe(onToggle: (toggled: boolean) => void): () => void {
        const uuid = crypto.randomUUID();
        this.onToggleSubscribers.set(uuid, onToggle);
        return () => {
            this.onToggleSubscribers.delete(uuid);
        };
    }

    public isToggled() {
        return this.toggled;
    }

    public toggleUntoggle() {
        console.log('Toggling highlighting...');
        this.toggled = !this.toggled;
        
        // if (this.toggled) {
        //     console.log("showing traces now");
        //     startVaultKeyMonitoring();
        // } else {
        //     console.log("hiding traces now");
        //     stopVaultKeyMonitoring();
        //     wsConnection?.close();
        //     wsConnection = null;
        //     tracesData = [];
        //     unhighlightTraces();
        //     clearHoverTraces();
        // }

        this.onToggleSubscribers.forEach(subscriber => subscriber(this.toggled));

        vscode.window.showInformationMessage(`Ariana traces: ${this.toggled ? 'Enabled' : 'Disabled'}`);
    }
}