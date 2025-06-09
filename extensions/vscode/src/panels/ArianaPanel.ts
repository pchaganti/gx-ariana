import * as vscode from 'vscode';
import { FocusedVaultManager } from '../vaults/FocusedVaultManager';
import { VaultsManager } from '../vaults/VaultsManager';
import { HighlightingToggle } from '../highlighting/HighlightingToggle';
import { Panel } from './Panel';

export class ArianaPanel extends Panel {
  public static readonly viewType = "ariana.sidebarView";
  private _timelinePanel?: Panel;

  constructor(
    _extensionUri: vscode.Uri,
    context: vscode.ExtensionContext,
    focusedVaultManager: FocusedVaultManager,
    vaultsManager: VaultsManager,
    highlightToggle: HighlightingToggle
  ) {
    super(_extensionUri, context, focusedVaultManager, vaultsManager, highlightToggle);
  }

  setTimelinePanel(panel: Panel) {
    this._timelinePanel = panel;
  }

  viewId(): string {
    return ArianaPanel.viewType;
  }

  onAfterResolveWebviewView(webviewView: vscode.WebviewView): void {}

  onBecameVisible(): void {}

  onMessageFromWebview(message: any): void {
    switch (message.command) {
      case 'showTimelinePanel':
        if (message.vaultId && this._timelinePanel) {
          console.log(`ArianaPanel: Received showTimelinePanel for vault ${message.vaultId}`);
          try {
            this._timelinePanel.focus();
          } catch (error) {
            console.error('Error interacting with bottom panel controller:', error);
            vscode.window.showErrorMessage('Could not show vault in detail panel.');
          }
        } else if (!this._timelinePanel) {
          console.warn('ArianaPanel: Bottom panel controller not available for showTimelinePanel.');
          vscode.window.showErrorMessage('Vault Detail Panel feature is not initialized.');
        } else if (!message.vaultId) {
          console.warn('ArianaPanel: showTimelinePanel message received without vaultId.');
        }
        break;
    }
  }
}
