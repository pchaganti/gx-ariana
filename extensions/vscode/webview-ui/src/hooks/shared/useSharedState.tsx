import { useEffect, useState, useCallback } from 'react';
import { postMessageToExtension } from '../../utils/vscode';

type StateMap = Record<string, any>;
type ListenerMap = Record<string, Set<(value: any) => void>>;
type MessageHandlerMap = Record<string, (message: any) => void>;

class SharedStateManager {
  private state: StateMap = {};
  private listeners: ListenerMap = {};
  private messageHandlers: MessageHandlerMap = {};
  private messageListener: ((event: MessageEvent) => void) | null = null;

  constructor() {
    this.setupMessageListener();
  }

  private setupMessageListener() {
    if (this.messageListener) return;

    this.messageListener = (event: MessageEvent) => {
      const message = event.data;
      const handler = this.messageHandlers[message.type];
      if (handler) {
        handler(message);
      }
    };

    window.addEventListener('message', this.messageListener);
  }

  register<T>(
    key: string,
    initialValue: T,
    messageType: string,
    command: string,
    valueExtractor: (message: any) => T = (message) => message.value
  ) {
    // Initialize state if not exists
    if (!(key in this.state)) {
      this.state[key] = initialValue;
    }

    // Initialize listeners set if not exists
    if (!(key in this.listeners)) {
      this.listeners[key] = new Set();
    }

    // Register message handler if not exists
    if (!(messageType in this.messageHandlers)) {
      this.messageHandlers[messageType] = (message: any) => {
        const newValue = valueExtractor(message);
        this.setState(key, newValue);
      };
    }

    // Request initial data
    postMessageToExtension({ command });

    return {
      getValue: () => this.state[key],
      subscribe: (callback: (value: T) => void) => {
        this.listeners[key].add(callback);
        return () => this.listeners[key].delete(callback);
      }
    };
  }

  private setState(key: string, value: any) {
    if (this.state[key] !== value) {
      this.state[key] = value;
      this.listeners[key]?.forEach(listener => listener(value));
    }
  }

  cleanup() {
    if (this.messageListener) {
      window.removeEventListener('message', this.messageListener);
      this.messageListener = null;
    }
    this.state = {};
    this.listeners = {};
    this.messageHandlers = {};
  }
}

const sharedStateManager = new SharedStateManager();

export function useSharedState<T>(
  key: string,
  initialValue: T,
  messageType: string,
  command: string,
  valueExtractor?: (message: any) => T
): T {
  const [state, setState] = useState<T>(initialValue);

  useEffect(() => {
    const manager = sharedStateManager.register(
      key,
      initialValue,
      messageType,
      command,
      valueExtractor
    );

    // Set current value
    setState(manager.getValue());

    // Subscribe to updates
    const unsubscribe = manager.subscribe((newValue: T) => {
      setState(newValue);
    });

    // The useEffect cleanup function must return a function that returns void.
    // manager.subscribe returns a function that returns a boolean (from Set.delete),
    // so we wrap it in another function to discard the return value.
    return () => {
      unsubscribe();
    };
  }, [key, messageType, command]);

  return state;
}

// Cleanup function for tests or when needed
export function cleanupSharedState() {
  sharedStateManager.cleanup();
}
