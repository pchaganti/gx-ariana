import { useState, useEffect } from 'react';
import { ArianaCliStatus } from '../lib/cli';
import { getVSCodeAPI } from './vscode';

// Define the shape of our global state
// export interface GlobalState {
//   // Tab state
//   activeTab: string;
  
//   // MainTab state
//   isOnboardingCollapsed: boolean;
  
//   // TracesTab state
//   tracesScrollPosition: number;
  
//   // ColorVisualizerTab state
//   colorTabSettings?: any;
  
//   // CLI status
//   cliStatus: ArianaCliStatus | null;
  
//   // Add more state properties as needed
// }

// Default state values
// const defaultState: GlobalState = {
//   activeTab: 'main',
//   isOnboardingCollapsed: false,
//   tracesScrollPosition: 0,
//   colorTabSettings: {},
//   cliStatus: null
// };

/**
 * Global state manager that persists state across tab changes and webview reopens
 * using VS Code's built-in state management.
 */
class StateManager {
  private state: Record<string, any>;
  
  constructor() {
    // Initialize state from VS Code API or use defaults
    const vscodeApi = getVSCodeAPI();
    const savedState = vscodeApi.getState() as Record<string, any> | undefined;
    
    this.state = savedState || {};
    
    // Save initial state if none exists
    if (!savedState) {
      this.saveState();
    }
    
    console.log('StateManager initialized with state:', this.state);
  }
  
  /**
   * Save the current state to VS Code's state storage
   */
  private saveState(): void {
    const vscodeApi = getVSCodeAPI();
    vscodeApi.setState(this.state);
    console.log('State saved:', this.state);
  }

  /**
   * Custom React hook that syncs component state with this state manager.
   * Use this as a replacement for useState when you want the state to be
   * automatically persisted in the global state.
   * 
   * @param key Key in the GlobalState to bind to
   * @param initialValue Optional default value if not present in global state
   * @returns A state tuple [value, setValue] just like React's useState
   */
  usePersistedState<T>(
    key: string,
    initialValue?: T
  ): [T, React.Dispatch<React.SetStateAction<T>>] {
    // Initialize from the state manager, or use initialValue if state doesn't exist
    const [value, setValue] = useState<T>(() => {
      const storedValue = this.state[key];
      return storedValue !== undefined ? storedValue : initialValue as T;
    });

    // Sync component state with state manager when component state changes
    useEffect(() => {
      this.state[key] = value;
      this.saveState();
    }, [key, value]);

    return [value, setValue];
  }
}

// Create a singleton instance
const stateManager = new StateManager();

export default stateManager;