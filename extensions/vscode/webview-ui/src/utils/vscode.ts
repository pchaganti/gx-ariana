// Singleton for VS Code API acquisition

interface VSCodeAPI {
  postMessage: (message: any) => void;
  getState: () => any;
  setState: (state: any) => void;
}

// Declare the VS Code API acquisition function that's injected by VS Code
declare function acquireVsCodeApi(): VSCodeAPI;

// Singleton instance
let vscodeApi: VSCodeAPI | undefined;

/**
 * Get the VS Code API instance. This ensures we only call acquireVsCodeApi() once.
 * Subsequent calls will return the cached instance.
 */
export function getVSCodeAPI(): VSCodeAPI {
  if (!vscodeApi) {
    try {
      // Try to acquire the VS Code API
      vscodeApi = acquireVsCodeApi();
      console.log('VS Code API acquired successfully');
    } catch (error) {
      console.warn('Failed to acquire VS Code API, fallback will be used:', error);
      // Provide a fallback for when running outside of VS Code
      vscodeApi = {
        postMessage: (message: any) => {
          console.log('Fallback postMessage:', message);
          window.parent.postMessage(message, '*');
        },
        getState: () => {
          return {};
        },
        setState: () => {
          // No-op in fallback mode
        }
      };
    }
  }
  return vscodeApi;
}

/**
 * Safe message posting function that works with the VS Code API
 * @param message The message to post to the extension
 */
export function postMessageToExtension(message: any): void {
  console.log('Posting message to extension:', message);
  const api = getVSCodeAPI();
  api.postMessage(message);
}
