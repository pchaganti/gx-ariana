import { useEffect } from 'react';
import MainTab from './components/MainTab';
import { postMessageToExtension } from './utils/vscode';
import Footer from './components/Footer';
import { useCliStatus } from './hooks/useCliStatus';
import { useViewId } from './hooks/useViewId';
import VaultTimelineView from './components/VaultTimelineView';
import { useWorkspaceRoots } from './hooks/useWorkspaceRoots';
import { useRenderNonce } from './hooks/useRenderNonce';

const App = () => {
    const cliStatus = useCliStatus();
    const viewId = useViewId();
    const workspaceRoots = useWorkspaceRoots();
    const renderNonce = useRenderNonce();

    useEffect(() => {
        window.addEventListener('message', handleMessage);
        return () => {
            window.removeEventListener('message', handleMessage);
        };
    }, []);

    const handleMessage = (event: MessageEvent) => {
        const message = event.data;

        switch (message.type) {
            case 'hotReload':
                console.log('Hot reload message received. Reloading webview...');
                // window.location.reload();
                break;
        }
    };

    const handleUpdate = () => {
        postMessageToExtension({ command: 'updateArianaCli' });
    };

    if (viewId === null) {
        return <div className="bg-[var(--bg-base)] flex items-center justify-center w-full h-full text-[var(--fg-base)] text-md font-mono">
            <div className="animate-pulse">
                Loading... (Waiting for viewId)
            </div>
        </div>;
    }

    if (!renderNonce) {
        return <div className="bg-[var(--bg-base)] flex items-center justify-center w-full h-full text-[var(--fg-base)] text-md font-mono">
            <div className="animate-pulse">
                Loading... (Waiting for render nonce)
            </div>
        </div>;
    }

    if (workspaceRoots.length === 0) {
        return <div className="bg-[var(--bg-base)] flex items-center justify-center w-full h-full text-[var(--fg-base)] text-md font-mono">
            <div className="animate-pulse">
                Workspace is empty
            </div>
        </div>;
    }

    if (viewId === 'ariana.timelineView') {
        return <VaultTimelineView />;
    }

    return (
        <div className={`flex flex-col h-screen max-h-screen w-screen max-w-screen text-base`}>
            <div className="flex flex-col h-full max-h-full w-full max-w-full">
                <div
                    className="flex flex-col w-full max-w-full h-full max-h-full"
                >
                    <div className="max-h-full h-full scrollbar-thumb-rounded-full scrollbar-track-rounded-full scrollbar-thin overflow-y-auto scrollbar-w-2 border-r-[1.5px] border-[var(--bg-base)]">
                        <MainTab />
                    </div>
                    <Footer cliStatus={cliStatus} onUpdate={handleUpdate} />
                </div>
            </div>
        </div>
    );
};

export default App;