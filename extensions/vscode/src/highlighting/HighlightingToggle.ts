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
        this.toggled = !this.toggled;

        this.onToggleSubscribers.forEach(subscriber => subscriber(this.toggled));

        vscode.window.showInformationMessage(`Ariana traces: ${this.toggled ? 'Enabled' : 'Disabled'}`);
    }
}