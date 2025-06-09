import { useState, useEffect, useCallback } from 'react';
import { postMessageToExtension } from '../utils/vscode';
import { setCurrentRenderNonce } from '../utils/timerManagement'; // Assuming this path

interface WebviewIdentityState {
    viewId: string | null;
    renderNonce: string | null;
}

export function useViewId(): string | null {
    const [identity, setIdentity] = useState<WebviewIdentityState>({ viewId: null, renderNonce: null });

    const handleMessage = useCallback((event: MessageEvent) => {
        const message = event.data;
        if (message.type === 'viewId') {
            console.log('useViewId: Received viewId:', message.value);
            setIdentity(prev => ({ ...prev, viewId: message.value }));
        } else if (message.type === 'renderNonce') {
            console.log('useViewId: Received renderNonce:', message.value);
            setCurrentRenderNonce(message.value); // Call the utility function
            setIdentity(prev => ({ ...prev, renderNonce: message.value }));
        }
    }, []);

    useEffect(() => {
        window.addEventListener('message', handleMessage);

        // If viewId is not yet set, request it.
        // This replaces the polling interval in App.tsx.
        if (identity.viewId === null) {
            console.log('useViewId: viewId is null, requesting from extension...');
            postMessageToExtension({ command: 'getViewId' });
        }

        return () => {
            window.removeEventListener('message', handleMessage);
        };
        // Only re-run if handleMessage changes (should not) or if viewId becomes null after being set (unlikely for this logic).
        // The main goal is to send the request once if viewId is initially null.
    }, [handleMessage, identity.viewId]);

    return identity.viewId;
}
