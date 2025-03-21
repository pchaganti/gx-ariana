import { Disposable, Webview, WebviewPanel, window, Uri, ViewColumn } from "vscode";
import { getUri } from "../utilities/getUri";
import { getNonce } from "../utilities/getNonce";
import { Trace } from "../bindings/Trace";

export type HighlightRequest = (file: string, startLine: number, startCol: number, endLine: number, endCol: number) => void;
export type TracesPanelMode = "trace" | "chronology";

export class TracesPanel {
    private static readonly panelToTracesMap = new Map<WebviewPanel, TracesPanel>();
    private readonly _panel: WebviewPanel;
    private _disposables: Disposable[] = [];
    private _mode: TracesPanelMode;
    private _lastSentTraces: Trace[] = [];

    private constructor(panel: WebviewPanel, extensionUri: Uri, traces: Trace[], mode: TracesPanelMode, onHighlightRequest: HighlightRequest) {
        this._panel = panel;
        this._mode = mode;
        this._lastSentTraces = traces;

        this._panel.onDidChangeViewState(e => {
            if (e.webviewPanel.visible) {
                this.sendDataToWebView(this._lastSentTraces);
            }
        });

        this._panel.webview.onDidReceiveMessage((message) => {
            if (message.command === 'highlight') {
                const { file, startLine, startCol, endLine, endCol } = message;
                onHighlightRequest(file, startLine, startCol, endLine, endCol);
            }
        });

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        this._panel.webview.html = this._getWebviewContent(this._panel.webview, extensionUri);

        this._setWebviewMessageListener(this._panel.webview);

        this.sendDataToWebView(traces);

        this._updateTitle();

        TracesPanel.panelToTracesMap.set(this._panel, this);
    }

    private _updateTitle() {
        this._panel.title = this._mode === "trace" ? "Ariana Traces" : "Ariana Chronology";
    }

    public sendDataToWebView(traces: Trace[]) {
        this._lastSentTraces = traces;
        this._panel.webview.postMessage({ traces });
    }

    public static render(extensionUri: Uri, traces: Trace[], mode: TracesPanelMode, onHighlightRequest: HighlightRequest): TracesPanel {
        const panel = window.createWebviewPanel(
            "arianaTraces",
            mode === "trace" ? "Ariana Traces" : "Ariana Chronology",
            ViewColumn.Beside,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    Uri.joinPath(extensionUri, "out"),
                    Uri.joinPath(extensionUri, "webview-ui/dist")
                ],
            }
        );

        return new TracesPanel(panel, extensionUri, traces, mode, onHighlightRequest);
    }

    public dispose() {
        TracesPanel.panelToTracesMap.delete(this._panel);
        this._panel.dispose();
        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }

    private _getWebviewContent(webview: Webview, extensionUri: Uri) {
        const stylesUri = getUri(webview, extensionUri, ["webview-ui", "dist", "assets", "index.css"]);
        const scriptUri = getUri(webview, extensionUri, ["webview-ui", "dist", "index.js"]);
        const nonce = getNonce();

        return /*html*/ `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}' 'wasm-unsafe-eval'; img-src ${webview.cspSource} https:;" />
          <link rel="stylesheet" type="text/css" href="${stylesUri}">
          <title>Ariana Traces</title>
        </head>
        <body>
          <div id="root"></div>
          <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
        </body>
      </html>
    `;
    }

    private _setWebviewMessageListener(webview: Webview) {
        webview.onDidReceiveMessage(
            (message: any) => {
                const command = message.command;
                const text = message.text;

                switch (command) {
                    case "hello":
                        window.showInformationMessage(text);
                        return;
                }
            },
            undefined,
            this._disposables
        );
    }
}