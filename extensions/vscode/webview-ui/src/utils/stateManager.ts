import { getVSCodeAPI } from './vscode';

// Define the shape of our global state
export interface GlobalState {
  // Tab state
  activeTab: string;
  
  // MainTab state
  isOnboardingCollapsed: boolean;
  
  // TracesTab state
  tracesScrollPosition: number;
  
  // ColorVisualizerTab state
  colorTabSettings?: any;
  
  // Add more state properties as needed
}

// Default state values
const defaultState: GlobalState = {
  activeTab: 'main',
  isOnboardingCollapsed: false,
  tracesScrollPosition: 0,
  colorTabSettings: {}
};

/**
 * Global state manager that persists state across tab changes and webview reopens
 * using VS Code's built-in state management.
 */
class StateManager {
  private state: GlobalState;
  
  constructor() {
    // Initialize state from VS Code API or use defaults
    const vscodeApi = getVSCodeAPI();
    const savedState = vscodeApi.getState() as GlobalState | undefined;
    
    this.state = savedState || { ...defaultState };
    
    // Save initial state if none exists
    if (!savedState) {
      this.saveState();
    }
    
    console.log('StateManager initialized with state:', this.state);
  }
  
  /**
   * Get the entire global state
   */
  getState(): GlobalState {
    return { ...this.state };
  }
  
  /**
   * Get a specific property from the global state
   */
  get<K extends keyof GlobalState>(key: K): GlobalState[K] {
    return this.state[key];
  }
  
  /**
   * Update a specific property in the global state
   */
  set<K extends keyof GlobalState>(key: K, value: GlobalState[K]): void {
    this.state[key] = value;
    this.saveState();
  }
  
  /**
   * Update multiple properties in the global state at once
   */
  update(partialState: Partial<GlobalState>): void {
    this.state = { ...this.state, ...partialState };
    this.saveState();
  }
  
  /**
   * Save the current state to VS Code's state storage
   */
  private saveState(): void {
    const vscodeApi = getVSCodeAPI();
    vscodeApi.setState(this.state);
    console.log('State saved:', this.state);
  }
}

// Create a singleton instance
const stateManager = new StateManager();

export default stateManager;
