import { useEffect, useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './components/ui/tabs';
import TracesTab from './components/TracesTab';
import ColorVisualizerTab from './components/ColorVisualizerTab';
import type { Trace } from './bindings/Trace';
import MainTab from './components/MainTab';
import { postMessageToExtension } from './utils/vscode';
import Footer from './components/Footer';

type HighlightRequest = (file: string, startLine: number, startCol: number, endLine: number, endCol: number) => void;

// Define interface for Ariana CLI status
interface ArianaCliStatus {
    isInstalled: boolean;
    version?: string;
    latestVersion?: string;
    needsUpdate: boolean;
    npmAvailable: boolean;
    pipAvailable: boolean;
    pythonPipAvailable: boolean;
    python3PipAvailable: boolean;
}

const App = () => {
    const [traces, setTraces] = useState<Trace[]>([]);
    const [requestHighlight, setRequestHighlight] = useState<HighlightRequest>(() => () => { });
    const [activeTab, setActiveTab] = useState('main');
    const [theme, setTheme] = useState('light');
    const [logoUrl, setLogoUrl] = useState('');
    const [textLogoUrl, setTextLogoUrl] = useState('');
    const [isSidebar, setIsSidebar] = useState(false);
    const [showColorTab, setShowColorTab] = useState(false);
    const [logoClicks, setLogoClicks] = useState<number[]>([]);
    const [isInitialized, setIsInitialized] = useState(false);
    const [cliStatus, setCliStatus] = useState<ArianaCliStatus | null>(null);

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

        // Get logo URLs from data attributes
        console.log('Logo URL from data attribute:', rootElement?.dataset.arianaLogo);
        console.log('Text logo URL from data attribute:', rootElement?.dataset.arianaTextLogo);
        if (rootElement?.dataset.arianaLogo) {
            setLogoUrl(rootElement.dataset.arianaLogo);
        }
        if (rootElement?.dataset.arianaTextLogo) {
            setTextLogoUrl(rootElement.dataset.arianaTextLogo);
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
        console.log('Detected theme from CSS:', isDark ? 'dark' : 'light');
        if (isDark) {
            setTheme('dark');
        } else {
            setTheme('light');
        }
    };

    const handleMessage = (event: MessageEvent) => {
        const message = event.data;
        console.log('Received message from extension:', message);

        switch (message.type) {
            case 'traces':
                setTraces(message.value);
                setActiveTab('traces');
                break;
            case 'theme':
                setTheme(message.value);
                break;
            case 'themeChange':
                setTheme(prev => prev === 'light' ? 'dark' : 'light');
                setTimeout(() => detectTheme(), 0);
                break;
            case 'arianaCliStatus':
                setCliStatus(message.value);
                break;
            case 'viewVisible':
                postMessageToExtension({ command: 'getArianaCliStatus' });
                break;
            default:
                console.log('Unhandled message type:', message.type);
        }
    };

    const handleLogoClick = () => {
        const now = Date.now();
        setLogoClicks(prev => {
            // Filter clicks that happened in the last second
            const recentClicks = [...prev.filter(time => now - time < 1000), now];

            if (recentClicks.length >= 5) {
                setShowColorTab(true);
                return [];
            }

            return recentClicks;
        });
    };

    const handleUpdate = () => {
        postMessageToExtension({ command: 'updateArianaCli' });
    };

    if (!isInitialized) {
        console.log('App not yet initialized, rendering loading state');
        return <div className="p-4">Loading Ariana...</div>;
    }

    return (
        <div className="flex flex-col h-screen overflow-hidden" style={{
            color: 'var(--foreground)',
        }}>
            {isSidebar ? (
                <div className="flex flex-col h-full max-h-full">
                    <Tabs
                        defaultValue="main"
                        value={activeTab}
                        onValueChange={setActiveTab}
                        className="flex-1 flex flex-col h-full max-h-full"
                    >
                        <div className="px-1">
                            <TabsList className="w-full">
                                <TabsTrigger value="main" className="flex-1">Main</TabsTrigger>
                                <TabsTrigger value="traces" className="flex-1">Traces</TabsTrigger>
                                {showColorTab && (
                                    <TabsTrigger value="colors" className="flex-1">Colors</TabsTrigger>
                                )}
                            </TabsList>
                        </div>

                        <TabsContent value="main" className="flex-1 h-[calc(100%-30px)] max-h-[calc(100%-30px)] mt-0">
                            <MainTab textLogoUrl={textLogoUrl} onLogoClick={handleLogoClick} />
                        </TabsContent>

                        <TabsContent value="traces" className="flex-1 overflow-auto mt-0 h-[calc(100%-30px)] max-h-[calc(100%-30px)]">
                            <TracesTab traces={traces} requestHighlight={requestHighlight} />
                        </TabsContent>

                        {showColorTab && (
                            <TabsContent value="colors" className="flex-1 overflow-auto mt-0 h-[calc(100%-30px)] max-h-[calc(100%-30px)]">
                                <ColorVisualizerTab />
                            </TabsContent>
                        )}
                    </Tabs>
                    
                    {/* Footer */}
                    <Footer cliStatus={cliStatus} />
                </div>
            ) : (
                // Regular webview (not sidebar)
                <div className="flex flex-col h-full">
                    <div className="flex-1">
                        <TracesTab traces={traces} requestHighlight={requestHighlight} />
                    </div>
                    
                    {/* Footer */}
                    <Footer cliStatus={cliStatus} />
                </div>
            )}
        </div>
    );
};

export default App;