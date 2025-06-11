import * as vscode from 'vscode';
import { FocusedVaultManager } from '../vaults/FocusedVaultManager';
import { VaultsManager } from '../vaults/VaultsManager';
import { HighlightingToggle } from '../highlighting/HighlightingToggle';
import { Panel } from './Panel';
import { TimelineService } from '../services/TimelineService';
import { LightTrace } from '../bindings/LightTrace';

export class TimelinePanel extends Panel {
  public static readonly viewType = "ariana.timelineView";
  private readonly _timelineService: TimelineService;

  constructor(
    _extensionUri: vscode.Uri,
    context: vscode.ExtensionContext,
    focusedVaultManager: FocusedVaultManager,
    vaultsManager: VaultsManager,
    highlightToggle: HighlightingToggle
  ) {
    super(_extensionUri, context, focusedVaultManager, vaultsManager, highlightToggle);
    this._timelineService = new TimelineService();
  }

  viewId(): string {
    return TimelinePanel.viewType;
  }

  onAfterResolveWebviewView(webviewView: vscode.WebviewView): void {
    this._timelineService.setWebview(webviewView.webview);
    // When the view is disposed, clean up the worker
    webviewView.onDidDispose(() => this.dispose(), null, this._disposables);
  }

  // Override the base panel's method to intercept traces
  sendLightTracesToWebview(traces: LightTrace[] | null): void {
    if (traces) {
      // Instead of sending raw traces, we send them to our service for processing
      this._timelineService.addTraces(traces);
    }
    // We don't call super.sendLightTracesToWebview() because we don't want to send raw traces anymore.
  }

  onMessageFromWebview(message: any): void {
    if (message.command === 'request-timeline-update') {
      this._timelineService.sendTimelineToWebview();
    }
  }

  onBecameVisible(): void {
    // If the view becomes visible, we might want to ensure it has the latest timeline
    this._timelineService.sendTimelineToWebview();
  }

  dispose(): void {
    super.dispose();
    this._timelineService.dispose();
  }
}
