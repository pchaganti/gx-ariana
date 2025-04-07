# Extension Refactoring Plan

## Current Issues

1. **Architectural Flaws:**
   - `extension.ts` has excessive exports that violate VS Code extension best practices
   - Global state management using module-level variables creates maintainability issues
   - Lack of clear separation between state management and UI functionality
   - Trace and vault management code is tightly coupled

2. **Global Variables in extension.ts:**
   - `tracesData`: Array of traces that should be encapsulated
   - `wsConnection`: WebSocket connection that should be managed by a service
   - `currentVaultSecretKey`: Current vault key that should be part of a state service
   - `showTraces`: Boolean that should be part of configuration/state management
   - Multiple other global variables that need proper management

3. **Violates Single Responsibility Principle:**
   - `extension.ts` handles multiple concerns: activation, trace management, vault management, WebSocket handling

## Existing Service-Based Structure

The codebase has already started moving toward a service-based architecture with these services:

1. **WebviewService**: Handles webview functionality
2. **RunCommandsService**: Manages run commands
3. **TraceService**: Manages trace-related functionality, but has limited scope
4. **VaultsManager**: Manages vault keys but lacks integration with other services

## Refactoring Approach

### 1. Create New Services

#### A. TraceManagerService

Responsibilities:
- Managing trace data (replacing the global `tracesData` array)
- WebSocket connection management for traces
- Highlighting traces in the editor
- Persisting traces by vault key

```typescript
// src/services/TraceManagerService.ts
export class TraceManagerService {
  private _traces: Map<string, Trace[]> = new Map(); // Map vault keys to their traces
  private _wsConnection: WebSocket | null = null;
  private _currentVaultKey: string | null = null;
  private _showTraces: boolean = false;
  
  // Methods for trace management
  // WebSocket connection handling
  // Trace highlighting
}
```

#### B. StateService

Responsibilities:
- Managing application state
- Providing event listeners for state changes
- Persisting state between sessions

```typescript
// src/services/StateService.ts
export class StateService {
  private _state: ExtensionState;
  private _onDidChangeState = new vscode.EventEmitter<ExtensionState>();
  public readonly onDidChangeState = this._onDidChangeState.event;
  
  // Methods for state management
}
```

### 2. Enhance VaultsManager

Extend `VaultsManager` functionality to:
- Add integration with `TraceManagerService`
- Properly manage vault selection
- Expose a new API for vault management

### 3. Refactor extension.ts

Restructure `extension.ts` to:
- Initialize services on activation
- Register commands and providers
- Handle VS Code-specific lifecycle events
- No longer export utility functions or store global state

## Implementation Plan

### Phase 1: Create the New Services

1. Create `TraceManagerService` to encapsulate all trace-related functionality
2. Create `StateService` for global state management
3. Modify `VaultsManager` to work with other services

### Phase 2: Refactor extension.ts

1. Move functionality from `extension.ts` to appropriate services
2. Initialize services during activation
3. Remove global variables
4. Remove exports except VS Code required methods

### Phase 3: Update UI Components

1. Update `SidebarPanel` to use the new services
2. Ensure proper communication between services and UI

## Technical Design

### Services Initialization

```typescript
export async function activate(context: vscode.ExtensionContext) {
  // Initialize services
  const stateService = new StateService(context);
  const vaultManager = VaultsManager.initialize(context);
  const traceManager = new TraceManagerService(context, vaultManager);
  const webviewService = new WebviewService(context.extensionUri);
  
  // Register services in a service container for dependency injection
  const serviceContainer = new ServiceContainer();
  serviceContainer.register('stateService', stateService);
  serviceContainer.register('vaultManager', vaultManager);
  serviceContainer.register('traceManager', traceManager);
  serviceContainer.register('webviewService', webviewService);
  
  // Initialize sidebar with services
  const sidebarProvider = new SidebarPanel(context.extensionUri, context, serviceContainer);
  
  // Register sidebar provider
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(SidebarPanel.viewType, sidebarProvider)
  );
  
  // Setup event listeners between services
  // ...
}
```

### Service Container for Dependency Injection

```typescript
// src/services/ServiceContainer.ts
export class ServiceContainer {
  private _services: Map<string, any> = new Map();
  
  public register<T>(name: string, service: T): void {
    this._services.set(name, service);
  }
  
  public get<T>(name: string): T {
    const service = this._services.get(name);
    if (!service) {
      throw new Error(`Service ${name} not found`);
    }
    return service as T;
  }
}
```

### Communication Between Services

Services will communicate through events and direct method calls, following these patterns:

1. **Event-based Communication**: Services expose events that other services can subscribe to
2. **Direct Method Calls**: Services can directly call methods on other services when needed
3. **State Synchronization**: Services can listen to state changes from the `StateService`

## Benefits of Refactoring

1. **Better Separation of Concerns**: Each service has a specific responsibility
2. **Improved Maintainability**: Easier to understand and maintain isolated components
3. **Better Testability**: Services can be tested in isolation
4. **Follows VS Code Best Practices**: Only exports required by VS Code
5. **State Management**: Proper state management with events for change notification
6. **Reusability**: Services can be used across different parts of the extension

## Potential Issues and Mitigations

1. **Refactoring Risk**: Test extensively after each phase
2. **Breaking Changes**: Update all dependent code to use the new service APIs
3. **Initial Overhead**: More code initially, but better maintainability long-term
