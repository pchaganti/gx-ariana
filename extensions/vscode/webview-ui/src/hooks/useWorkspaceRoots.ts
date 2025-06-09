import { useEffect, useCallback, useState } from 'react';
import { postMessageToExtension } from '../utils/vscode';

export function useWorkspaceRoots(): string[] {
    const [workspaceRoots, setWorkspaceRoots] = useState<string[]>([]);

    const handleMessage = useCallback((event: MessageEvent) => {
        const message = event.data;
        if (message.type === 'updateWorkspaceRoots') {
            console.log('useWorkspaceRoots: Received workspace roots update:', message.payload);
            setWorkspaceRoots(message.payload || []);
        }
    }, [setWorkspaceRoots]);

    useEffect(() => {
        window.addEventListener('message', handleMessage);

        // Initial request if roots are empty.
        // The dependency on workspaceRoots.length ensures that if the roots are ever cleared (e.g. by stateManager cleanup or manually),
        // and the component using this hook re-renders, it will attempt to re-fetch them.
        if (workspaceRoots.length === 0) {
            console.log('useWorkspaceRoots: Workspace roots are empty, requesting from extension...');
            postMessageToExtension({ command: 'getWorkspaceRoots' });
        }

        return () => {
            window.removeEventListener('message', handleMessage);
        };
    }, [handleMessage, workspaceRoots.length]); // Re-run if length changes, e.g. if cleared

    return workspaceRoots;
}
