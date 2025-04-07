# Vault Management Enhancement

## Overview
This feature enhances the vault management system to track and provide access to multiple vault keys over time, with proper timestamps and notification systems.

## Current Implementation

- `VaultsManager` class in `manager.ts` handles vault key discovery and management
- Already has partial implementation for vault history with `VaultHistoryEntry` interface
- Has methods for finding the nearest `.ariana` directory and reading the `.vault_secret_key` file
- `getCurrentLocalVaultKey()` reads the current key but doesn't store it

## Requirements

### A.1: Store Vault Keys with Creation Time
- Each time a new vault key is detected, save it to persistent storage
- Use the last modification time of the `.vault_secret_key` file as the creation timestamp
- Implement the `storeVaultKey()` method to handle this functionality

### A.2: Subscribe to New Vault Notifications
- Implement an event emitter system that allows code to subscribe to new vault events
- Create `onDidAddVault` event that fires when a new vault is found
- Enable registration of callback functions that execute when new vaults are detected

### A.3: Retrieve Sorted Vault History
- Provide a method to get all past vault keys with their creation timestamps
- Sort vaults from most recent to oldest based on creation time
- Return a list of `VaultHistoryEntry` objects

## Technical Design

### Data Structures
```typescript
export interface VaultHistoryEntry {
    key: string;
    createdAt: number; // Unix timestamp in milliseconds
}
```

### Events
```typescript
private readonly _onDidAddVault = new vscode.EventEmitter<VaultHistoryEntry>();
public readonly onDidAddVault = this._onDidAddVault.event;
```

### Storage
- Use VS Code's `globalState` for persistence
- Store history under a dedicated key: `ariana.vaultHistory`

### Key Methods
- `storeVaultKey(key: string, vaultKeyPath: string)`: Store a vault key with its creation time
- `addVaultToHistory(key: string, createdAt: number)`: Add a vault key to history if it doesn't exist
- `getVaultHistory()`: Return sorted vault history from most recent to oldest

## Integration Points
- Update `checkVaultKeyAndUpdateConnection()` in `extension.ts` to store vault keys
- Update Sidebar and TraceService to use vault history
- Modify WebSocket connection logic to listen based on the selected vault
