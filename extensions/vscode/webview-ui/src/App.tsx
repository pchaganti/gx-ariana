import { useEffect, useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './components/ui/tabs';
import TracesTab from './components/TracesTab';
import ThemeColorsTab from './components/ThemeColorsTab';
import type { Trace } from './bindings/Trace';
import MainTab from './components/MainTab';
import { postMessageToExtension } from './utils/vscode';
import Footer from './components/Footer';
import stateManager from './utils/stateManager';
import { ArianaCliStatus } from './lib/cli';
import { setCurrentRenderNonce, setTimeoutCancelIfDifferentNonce } from './utils/timerManagement';
import VaultSelector, { VaultHistoryEntry } from './components/VaultSelector';

const App = () => {
    const [traces, setTraces] = stateManager.usePersistedState<Trace[]>('traces', []);
    const [activeTab, setActiveTab] = stateManager.usePersistedState<string>('activeTab', 'main');
    const [isSidebar, setIsSidebar] = useState(false);
    const [isInitialized, setIsInitialized] = useState(false);
    const [theme, setTheme] = useState('vscode-light');
    const [cliStatus, setCliStatus] = stateManager.usePersistedState<ArianaCliStatus | null>('cliStatus', null);
    const [focusableVaults, setFocusableVaults] = stateManager.usePersistedState<VaultHistoryEntry[]>('focusableVaults', []);
    const [focusedVault, setFocusedVault] = stateManager.usePersistedState<string | null>('focusedVault', null);
    const [highlightingToggled, setHighlightingToggled] = stateManager.usePersistedState<boolean>('highlightingToggle', false);
    const [isRefreshingVaults, setIsRefreshingVaults] = useState(false);

    // Initialize the app
    useEffect(() => {
        console.log('App component mounted, initializing...');

        // Get root element for debugging
        const rootElement = document.getElementById('root');
        console.log('Root element:', rootElement);

        // Get VS Code context from data attribute
        const vscodeContext = rootElement?.dataset.vscodeContext;
        console.log('VSCode context:', vscodeContext);

        if (vscodeContext) {
            try {
                const parsedContext = JSON.parse(vscodeContext);
                console.log('Parsed context:', parsedContext);
                setIsSidebar(parsedContext.webviewType === 'sidebar');
                console.log('Is sidebar:', parsedContext.webviewType === 'sidebar');
            } catch (error) {
                console.error('Failed to parse VSCode context', error);
            }
        }

        setIsInitialized(true);
    }, []);

    // Set up message handling and theme detection
    useEffect(() => {
        if (!isInitialized) {
            return;
        }

        console.log('Setting up message handling...');

        // Add message event listener
        console.log('Adding message event listener');
        window.addEventListener('message', handleMessage);

        // Detect theme on mount
        console.log('Detecting initial theme');
        detectTheme();

        // Request CLI status on mount
        console.log('Requesting initial CLI status');
        postMessageToExtension({
            command: 'getArianaCliStatus'
        });

        // Request focusable vaults on mount
        console.log('Requesting focusable vaults');
        refreshFocusableVaults();

        // Clean up
        return () => {
            console.log('App component unmounting, removing event listener');
            window.removeEventListener('message', handleMessage);
        };
    }, [isInitialized]);

    const detectTheme = () => {
        console.log('Detecting theme...');
        // Request theme info from the extension
        postMessageToExtension({ command: 'getTheme' });
        console.log('Sent getTheme message to extension');

        // Also try to detect from CSS variables as a fallback
        const isDark = document.body.classList.contains('vscode-dark') ||
            window.matchMedia('(prefers-color-scheme: dark)').matches;
        setTheme(isDark ? 'vscode-dark' : 'vscode-light');
        console.log('Detected theme from CSS:', isDark ? 'dark' : 'light');
    };

    const refreshFocusableVaults = () => {
        setIsRefreshingVaults(true);
        postMessageToExtension({ command: 'refreshFocusableVaults' });
    };

    const handleMessage = (event: MessageEvent) => {
        const message = event.data;
        console.log('Received message from extension:', message);

        switch (message.type) {
            case 'traces':
                setTraces(message.value);
                // Only change tab if explicitly requested or if we have traces and no tab is active
                if (message.switchToTab || (message.value.length > 0 && !activeTab)) {
                    handleTabChange('traces');
                }
                break;
            case 'theme':
                setTheme(message.value === 'dark' ? 'vscode-dark' : 'vscode-light');
                break;
            case 'themeChange':
                setTimeoutCancelIfDifferentNonce(() => detectTheme(), 1000, 'themeChange');
                break;
            case 'arianaCliStatus':
                setCliStatus(message.value);
                break;
            case 'viewVisible':
                postMessageToExtension({ command: 'getArianaCliStatus' });
                break;
            case 'hotReload':
                console.log('This render was triggered by a hot reload.');
                break;
            case 'renderNonce':
                console.log('Received new render nonce:', message.value);
                setCurrentRenderNonce(message.value);
                break;
            case 'focusableVaults':
                console.log('Received focusable vaults:', message.value);
                setFocusableVaults(message.value);
                setIsRefreshingVaults(false); // Stop refreshing animation when we get vaults
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

    if (!isInitialized) {
        console.log('App not yet initialized, rendering loading state');
        return <div className="p-4">Loading Ariana...</div>;
    }

    return (
        <div className={`${theme} flex flex-col h-screen max-h-screen w-screen max-w-screen overflow-hidden text-base`}>
            {isSidebar ? (
                <div className="flex flex-col h-full max-h-full w-full max-w-full">
                    <Tabs
                        defaultValue="main"
                        value={activeTab}
                        onValueChange={handleTabChange}
                        className="flex flex-col w-full max-w-full h-full max-h-full"
                    >
                        <TabsList className="w-full">
                            <TabsTrigger value="main" className="flex-1">Home</TabsTrigger>
                            <TabsTrigger value="traces" className="flex-1">Analyze</TabsTrigger>
                            <TabsTrigger value="theme" className="flex-1">Theme</TabsTrigger>
                        </TabsList>
                        
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
            ) : (
                <div className="flex flex-col h-full">
                    <MainTab />
                    <Footer cliStatus={cliStatus} onUpdate={handleUpdate} />
                </div>
            )}
        </div>
    );
};

export default App;