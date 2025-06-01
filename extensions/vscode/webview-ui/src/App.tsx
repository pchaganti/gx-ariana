import { useEffect } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './components/ui/tabs';
import TracesTab from './components/TracesTab';
import ThemeColorsTab from './components/ThemeColorsTab';
import MainTab from './components/MainTab';
import { postMessageToExtension } from './utils/vscode';
import Footer from './components/Footer';
import stateManager from './utils/stateManager';
import { setCurrentRenderNonce } from './utils/timerManagement';
import { useTraces } from './hooks/useTraces';
import { useFocusableVaults } from './hooks/useFocusableVaults';
import { useCliStatus } from './hooks/useCliStatus';

const App = () => {
    const traces = useTraces();
    const [activeTab, setActiveTab] = stateManager.usePersistedState<string>('activeTab', 'main');
    const cliStatus = useCliStatus();
    const { focusableVaults, isRefreshingVaults } = useFocusableVaults();
    const [focusedVault, setFocusedVault] = stateManager.usePersistedState<string | null>('focusedVault', null);
    const [highlightingToggled, setHighlightingToggled] = stateManager.usePersistedState<boolean>('highlightingToggle', false);

    useEffect(() => {
        window.addEventListener('message', handleMessage);

        // Calls to getArianaCliStatus and refreshFocusableVaults are now in their respective hooks

        // Clean up
        return () => {
            window.removeEventListener('message', handleMessage);
        };
    }, []);

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
            case 'focusedVault':
                console.log('Received focused vault:', message.value);
                setFocusedVault(message.value);
                break;
            case 'setHighlightingToggle':
                console.log('Setting highlighting toggle state:', message.value);
                setHighlightingToggled(message.value);
                break;
            default:
                console.log('Unhandled message type:', message.type);
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

    return (
        <div className={`flex flex-col h-screen max-h-screen w-screen max-w-screen overflow-hidden text-base`}>
            <div className="flex flex-col h-full max-h-full w-full max-w-full">
                <Tabs
                    defaultValue="main"
                    value={activeTab}
                    onValueChange={handleTabChange}
                    className="flex flex-col w-full max-w-full h-full max-h-full"
                >   
                    <TabsContent value="main" className="max-h-full h-full overflow-y-auto scrollbar-w-2">
                        <MainTab />
                    </TabsContent>

                    <TabsContent value="traces" className="max-h-full h-full overflow-y-auto scrollbar-w-2 max-w-full w-full">
                        <TracesTab traces={traces} focusableVaults={focusableVaults} focusedVault={focusedVault} highlightingToggled={highlightingToggled} isRefreshingVaults={isRefreshingVaults} />
                    </TabsContent>

                    <TabsContent value="theme" className="flex-1 overflow-hidden max-w-full w-full mt-0 h-[calc(100%-30px)] max-h-[calc(100%-30px)]">
                        <ThemeColorsTab />
                    </TabsContent>
                    <Footer cliStatus={cliStatus} onUpdate={handleUpdate} />
                </Tabs>
            </div> 
        </div>
    );
};

export default App;