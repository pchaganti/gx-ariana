# Trace UI Enhancements

## Overview
This feature enhances the Traces panel in the webview UI to organize traces by vault, allow switching between vaults, and improve the UI for enabling/disabling trace highlighting.

## Current Implementation

### Extension
- `extension.ts` contains global variables for trace management:
  - `tracesData`: Array to store trace data
  - `wsConnection`: WebSocket connection for receiving traces
  - `currentVaultSecretKey`: Tracks the current vault key
  - `showTraces`: Boolean controlling whether traces are highlighted

- `connectToTraceWebSocket()`: Establishes WebSocket connection and handles messages
- `checkVaultKeyAndUpdateConnection()`: Updates connection when vault key changes

### WebView
- `TracesTab.tsx`: Displays trace data in the webview
  - Shows trace entries with timestamps, line numbers, and values
  - Allows highlighting code when a trace is clicked
  - Does not currently organize traces by vault

### Services
- `TraceService`: Handles trace-related functionality
  - Highlighting code in the editor
  - Sending traces to the webview

## Requirements

### B.1: Organize Traces Per Vault
- Group traces by their vault ("run")
- Display vault creation time as "run started X sec ago"

### B.2: Always Listen to New Vault Traces
- Always connect to WebSocket when a vault is found
- Separate `showTraces` logic from WebSocket connection logic
- `showTraces` should only control highlighting, not listening

### B.3: Clear Traces When Switching Vaults
- When switching to a different vault:
  - Clear existing traces array
  - Disconnect from current WebSocket
  - Reconnect to WebSocket for new vault

### B.4: Current Run Indicator and Selector
- Show the current vault/run at the top of the traces tab
- Display time elapsed since the run started
- Add a dropdown menu to switch between available runs

### B.5: Trace Overlay Toggle Button
- Add a toggle button at the top of the panel
- Use it to enable/disable the `showTraces` boolean
- Clearly indicate that this controls overlay/highlighting only

### B.6: Display Traces for Current Run
- Show traces for the currently selected vault/run
- Update UI components when the selected vault changes

## Technical Design

### Data Structures
```typescript
// Track traces by vault key
interface TracesByVault {
  [vaultKey: string]: Trace[];
}

// Vault selection information
interface VaultInfo {
  key: string; 
  createdAt: number;
  isActive: boolean;
}
```

### Extension Changes
- Modify the trace data structure to organize by vault key
- Update WebSocket connection logic to always connect when a vault exists
- Decouple highlighting from connection management

### WebView Changes
- Create a vault selector component with dropdown
- Add trace overlay toggle button
- Modify TracesTab to display traces for the selected vault
- Add time-based formatting for "run started X ago"

### Message Types
```typescript
// New message types
type VaultSelectionMessage = { type: 'vaultSelected', key: string };
type ToggleTraceOverlayMessage = { type: 'toggleTraceOverlay', value: boolean };
type AvailableVaultsMessage = { type: 'availableVaults', vaults: VaultInfo[] };
```

## Integration Points
- `VaultsManager`: Subscribe to vault changes
- `extension.ts`: Update WebSocket management and trace organization
- `SidebarPanel`: Add message handlers for vault selection and overlay toggle
- `TracesTab.tsx`: Update to support vault-based organization and selection
