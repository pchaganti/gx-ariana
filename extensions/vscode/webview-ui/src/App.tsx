import { useEffect, useState } from 'react';
import MainTab from './components/MainTab';
import { postMessageToExtension } from './utils/vscode';
import Footer from './components/Footer';
import { setCurrentRenderNonce } from './utils/timerManagement';
import { useCliStatus } from './hooks/useCliStatus';
import VaultTimelineView from './components/VaultTimelineView';

const App = () => {
    const cliStatus = useCliStatus();
    const [viewId, setViewId] = useState<string | null>(null);

    useEffect(() => {
        window.addEventListener('message', handleMessage);

        // Request viewId periodically if not set
        let intervalId: NodeJS.Timeout | undefined;
        if (viewId === null) {
            postMessageToExtension({ command: 'getViewId' }); // Initial request
            intervalId = setInterval(() => {
                console.log('Requesting viewId from extension...');
                postMessageToExtension({ command: 'getViewId' });
            }, 1000); // Request every 1 second
        }

        return () => {
            window.removeEventListener('message', handleMessage);
            if (intervalId) {
                clearInterval(intervalId);
            }
        };
    }, [viewId]); // Rerun effect if viewId changes (to clear interval)

    const handleMessage = (event: MessageEvent) => {
        const message = event.data;
        // console.log('Received message from extension:', message); // Keep for debugging if needed

        switch (message.type) {
            case 'hotReload':
                console.log('This render was triggered by a hot reload.');
                break;
            case 'renderNonce':
                console.log('Received new render nonce:', message.value);
                setCurrentRenderNonce(message.value);
                break;
            case 'viewId':
                console.log('Received viewId:', message.value);
                setViewId(message.value); // This will trigger useEffect cleanup to stop polling
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

    if (viewId === 'ariana.timelineView') {
        return <VaultTimelineView />;
    }

    // Default to sidebar view
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