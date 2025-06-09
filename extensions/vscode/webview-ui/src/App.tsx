import { useEffect } from 'react';
import { Tabs, TabsContent } from './components/ui/tabs';
import TracesTab from './components/TracesTab';
import ThemeColorsTab from './components/ThemeColorsTab';
import MainTab from './components/MainTab';
import { postMessageToExtension } from './utils/vscode';
import Footer from './components/Footer';
import stateManager from './utils/stateManager';
import { setCurrentRenderNonce } from './utils/timerManagement';
import VaultDetailView from './components/VaultDetailView';
import { useCliStatus } from './hooks/useCliStatus';
import { useState } from 'react';

const LEGAL_TABS = ['main'];

type ViewMode = 'sidebar' | 'vaultDetail';


const App = () => {
    const [activeTab, setActiveTab] = stateManager.usePersistedState<string>('activeTab', 'main');
    const cliStatus = useCliStatus();
    const [currentView, setCurrentView] = useState<ViewMode>('sidebar'); // Default to sidebar view
    const [detailVaultId, setDetailVaultId] = useState<string | null>(null);

    useEffect(() => {
        window.addEventListener('message', handleMessage);

        // Calls to getArianaCliStatus and refreshFocusableVaults are now in their respective hooks

        // Clean up
        return () => {
            window.removeEventListener('message', handleMessage);
        };
    }, []);

    useEffect(() => {
        if (!LEGAL_TABS.includes(activeTab)) {
            handleTabChange('main');
        }
    }, [activeTab]);

    const handleMessage = (event: MessageEvent) => {
        const message = event.data;
        console.log('Received message from extension:', message);

        switch (message.type) {
            case 'hotReload':
                console.log('This render was triggered by a hot reload.');
                break;
            case 'renderNonce':
                console.log('Received new render nonce:', message.value);
                setCurrentRenderNonce(message.value);
                break;
            case 'navigateToPage':
                console.log('Received navigateToPage:', message.route);
                if (message.route && typeof message.route === 'string') {
                    const parts = message.route.split('/');
                    if (parts[1] === 'vault-details' && parts[2]) {
                        setDetailVaultId(parts[2]);
                        setCurrentView('vaultDetail');
                    } else {
                        // Default or unknown route, go to sidebar view
                        // setCurrentView('sidebar'); // Or handle as needed, for now only vault-details changes view
                        console.log('NavigateToPage: route not for vault-details, currentView remains:', currentView);
                    }
                } else {
                     console.warn('NavigateToPage: Invalid route received', message.route);
                }
                break;
        }
    };

    const handleUpdate = () => {
        postMessageToExtension({ command: 'updateArianaCli' });
    };

    // Handle tab change and persist in state manager
    const handleTabChange = (value: string) => {
        setActiveTab(value);

        console.log('Tab changed to:', value);
    };

    if (currentView === 'vaultDetail') {
        return <VaultDetailView vaultId={detailVaultId} />;
    }

    // Default to sidebar view
    return (
        <div className={`flex flex-col h-screen max-h-screen w-screen max-w-screen text-base`}>
            <div className="flex flex-col h-full max-h-full w-full max-w-full">
                <Tabs
                    defaultValue="main"
                    value={activeTab}
                    onValueChange={handleTabChange}
                    className="flex flex-col w-full max-w-full h-full max-h-full"
                >   
                    <TabsContent value="main" className="max-h-full h-full overflow-y-auto scrollbar-w-2 border-r-[1.5px] border-[var(--bg-base)]">
                        <MainTab />
                    </TabsContent>
                    <Footer cliStatus={cliStatus} onUpdate={handleUpdate} />
                </Tabs>
            </div> 
        </div>
    );
};

export default App;