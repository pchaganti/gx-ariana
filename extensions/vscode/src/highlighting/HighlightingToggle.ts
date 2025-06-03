import * as vscode from 'vscode';

export class HighlightingToggle {
    private toggled: boolean;
    private onToggleSubscribers: Map<string, (toggled: boolean) => void> = new Map();
    private static readonly TOGGLE_STATE_KEY = 'arianaHighlightingToggled';

    constructor() {
        // Initialize from global state or default to true if not found
        this.toggled = vscode.workspace.getConfiguration().get(HighlightingToggle.TOGGLE_STATE_KEY, true);
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

    public setState(newState: boolean) {
        if (this.toggled === newState) {
            return; // Avoid unnecessary updates
        }

        this.toggled = newState;
        
        // Save the toggle state to global configuration
        vscode.workspace.getConfiguration().update(HighlightingToggle.TOGGLE_STATE_KEY, this.toggled, vscode.ConfigurationTarget.Global);

        this.onToggleSubscribers.forEach(subscriber => subscriber(this.toggled));

        vscode.window.setStatusBarMessage(`Ariana traces overlay: ${this.toggled ? 'Enabled' : 'Disabled'}`, 3000);
    }

    public toggleUntoggle() {
        this.toggled = !this.toggled;
        
        // Save the toggle state to global configuration
        vscode.workspace.getConfiguration().update(HighlightingToggle.TOGGLE_STATE_KEY, this.toggled, vscode.ConfigurationTarget.Global);

        this.onToggleSubscribers.forEach(subscriber => subscriber(this.toggled));

        vscode.window.setStatusBarMessage(`Ariana traces overlay: ${this.toggled ? 'Enabled' : 'Disabled'}`, 3000);
    }
}