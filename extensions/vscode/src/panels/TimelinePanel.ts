import * as vscode from 'vscode';
import { FocusedVaultManager } from '../vaults/FocusedVaultManager';
import { VaultsManager } from '../vaults/VaultsManager';
import { HighlightingToggle } from '../highlighting/HighlightingToggle';
import { Panel } from './Panel';
import { LightTrace } from '../bindings/LightTrace';

export class TimelinePanel extends Panel {
  public static readonly viewType = "ariana.timelineView";

  constructor(
    _extensionUri: vscode.Uri,
    context: vscode.ExtensionContext,
    focusedVaultManager: FocusedVaultManager,
    vaultsManager: VaultsManager,
    highlightToggle: HighlightingToggle
  ) {
    super(_extensionUri, context, focusedVaultManager, vaultsManager, highlightToggle);
  }

  viewId(): string {
    return TimelinePanel.viewType;
  }

  onAfterResolveWebviewView(webviewView: vscode.WebviewView): void {
    // When the view is disposed, clean up the worker
    webviewView.onDidDispose(() => this.dispose(), null, this._disposables);
  }

  // Override the base panel's method to intercept traces
  sendLightTracesToWebview(traces: LightTrace[] | null): void {
  }

  onMessageFromWebview(message: any): void {
  }

  onBecameVisible(): void {
  }

  dispose(): void {
    super.dispose();
  }
}
