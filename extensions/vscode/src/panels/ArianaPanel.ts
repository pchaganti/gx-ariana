import * as vscode from 'vscode';
import { Trace } from '../bindings/Trace';
import { ArianaCliStatus, ArianaInstallMethod, getArianaCliStatus, installArianaCli, updateArianaCli } from '../installation/cliManager';
import { WebviewService } from '../services/WebviewService';
import { RunCommandsService } from '../services/RunCommandsService';
import { TraceService } from '../services/TraceService';
import { HotReloadService } from '../services/HotReloadService';

export class ArianaPanel implements vscode.WebviewViewProvider {
  public static readonly viewType = "ariana.sidebarView";
  private _view?: vscode.WebviewView;
  private _lastSentTraces?: Trace[];
  private _context: vscode.ExtensionContext;
  private _webviewService: WebviewService;
  private _runCommandsService: RunCommandsService;
  private _traceService: TraceService;
  private _hotReloadService: HotReloadService;

  constructor(private readonly _extensionUri: vscode.Uri, context: vscode.ExtensionContext) {
    this._context = context;
    this._webviewService = new WebviewService(_extensionUri);
    this._runCommandsService = new RunCommandsService(context);
    this._traceService = new TraceService();
    this._hotReloadService = new HotReloadService(_extensionUri, this._webviewService);
    console.log('ArianaPanel constructor called with extension URI:', _extensionUri.toString());
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    console.log('resolveWebviewView called');
    this._view = webviewView;

    // Set up hot reload service with current webview
    this._hotReloadService.setWebviewPanel(webviewView);

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri]
    };

    webviewView.webview.html = this._webviewService.getWebviewContent(webviewView.webview);

    // Handle messages from the webview
    webviewView.webview.onDidReceiveMessage(async message => {
      console.log('Received message from webview:', message);
      this.handleMessageFromWebview(message);
    });

    // Send initial theme information
    this._webviewService.sendThemeInfo(webviewView.webview);
    
    // Send initial render nonce for timer management
    this._webviewService.sendRenderNonce(webviewView.webview);

    // Register theme change listener
    this._webviewService.registerThemeChangeListener(webviewView.webview);

    // If we have traces already, send them to the webview
    if (this._lastSentTraces) {
      this.sendDataToWebView(this._lastSentTraces);
    }

    // When the view becomes visible, notify the webview
    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        this._view?.webview.postMessage({ type: 'viewVisible' });
        // Send a fresh render nonce when view becomes visible again
        this._webviewService.sendRenderNonce(webviewView.webview);
      }
    });

    // Send initial CLI status
    this.checkAndSendArianaCliStatus();
  }

  /**
   * Send trace data to the webview
   */
  public sendDataToWebView(traces: Trace[]) {
    if (this._view) {
      this._lastSentTraces = traces;
      this._traceService.sendTracesToWebview(this._view.webview, traces);
    } else {
      console.log('Cannot send traces - webview not initialized');
    }
  }

  /**
   * Check and send Ariana CLI status to the webview
   */
  private async checkAndSendArianaCliStatus() {
    try {
      const status = await getArianaCliStatus();
      this.sendArianaCliStatus(status);
    } catch (error) {
      console.error('Error checking Ariana CLI status:', error);
    }
  }

  /**
   * Send Ariana CLI status to the webview
   */
  private sendArianaCliStatus(status: ArianaCliStatus) {
    if (this._view) {
      try {
        this._view.webview.postMessage({ type: 'arianaCliStatus', value: status });
      } catch (error) {
        console.error('Error sending Ariana CLI status to webview:', error);
      }
    }
  }

  /**
   * Handle messages from the webview
   */
  private async handleMessageFromWebview(message: any) {
    switch (message.command) {
      case 'getTheme':
        // Send the current theme to the webview
        if (this._view) {
          this._webviewService.sendThemeInfo(this._view.webview);
        }
        break;
      case 'getArianaCliStatus':
        await this.checkAndSendArianaCliStatus();
        break;
      case 'installArianaCli':
        await this.installArianaCli(message.method);
        break;
      case 'updateArianaCli':
        await this.updateArianaCli();
        break;
      case 'getRunCommands':
        if (message.clearCache) {
          this._runCommandsService.clearCache();
        }
        if (this._view) {
          await this._runCommandsService.getRunCommands(this._view.webview);
        }
        break;
      case 'runArianaCommand':
        if (message.commandData) {
          this._runCommandsService.executeRunCommand(message.commandData);
        }
        break;
      case 'highlightCode':
        await this._traceService.highlightCode(
          message.file,
          message.startLine,
          message.startCol,
          message.endLine,
          message.endCol
        );
        break;
      case 'openExternal':
        if (message.url) {
          vscode.env.openExternal(vscode.Uri.parse(message.url));
        }
        break;
      default:
        console.log(`Unknown command: ${message.command}`);
    }
  }

  /**
   * Install Ariana CLI
   */
  private async installArianaCli(method: ArianaInstallMethod) {
    try {
      // Show progress notification
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Installing Ariana CLI...',
        cancellable: false
      }, async () => {
        await installArianaCli(method, this._context);
      });

      // Check and send updated status
      await this.checkAndSendArianaCliStatus();

      // Show success message
      vscode.window.showInformationMessage('Ariana CLI installed successfully!');
    } catch (error) {
      console.error('Error installing Ariana CLI:', error);
      vscode.window.showErrorMessage(`Failed to install Ariana CLI: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public async updateArianaCli(): Promise<void> {
    try {
      // Show progress notification
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Updating Ariana CLI...',
        cancellable: false
      }, async () => {
        await updateArianaCli(this._context);
      });

      // Check and send updated status
      await this.checkAndSendArianaCliStatus();

      // Show success message
      vscode.window.showInformationMessage('Ariana CLI updated successfully!');
    } catch (error) {
      console.error('Error updating Ariana CLI:', error);
      vscode.window.showErrorMessage(`Failed to update Ariana CLI: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
