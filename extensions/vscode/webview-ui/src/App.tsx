import { useEffect, useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './components/ui/tabs';
import TracesTab from './components/TracesTab';
import ColorVisualizerTab from './components/ColorVisualizerTab';
import type { Trace } from './bindings/Trace';
import MainTab from './components/MainTab';

type HighlightRequest = (file: string, startLine: number, startCol: number, endLine: number, endCol: number) => void;

declare const acquireVsCodeApi: () => {
  postMessage: (message: any) => void;
  getState: () => any;
  setState: (state: any) => void;
};

const App = () => {
  const [traces, setTraces] = useState<Trace[]>([]);
  const [requestHighlight, setRequestHighlight] = useState<HighlightRequest>(() => () => {});
  const [activeTab, setActiveTab] = useState('main');
  const [theme, setTheme] = useState('light');
  const [logoUrl, setLogoUrl] = useState('');
  const [textLogoUrl, setTextLogoUrl] = useState('');
  const [isSidebar, setIsSidebar] = useState(false);
  const [key, setKey] = useState(0);
  const [showColorTab, setShowColorTab] = useState(false);
  const [logoClicks, setLogoClicks] = useState<number[]>([]);

  useEffect(() => {
    // Get VSCode API
    const vscode = acquireVsCodeApi();

    // Check if we're in the sidebar
    const rootElement = document.getElementById('root');
    if (rootElement) {
      const context = rootElement.dataset.vscodeContext;
      if (context) {
        try {
          const parsedContext = JSON.parse(context);
          setIsSidebar(parsedContext.webviewType === 'sidebar');
        } catch (e) {
          console.error('Failed to parse VSCode context', e);
        }
      }

      // Get logo URLs from data attributes
      if (rootElement.dataset.arianaLogo) {
        setLogoUrl(rootElement.dataset.arianaLogo);
      }
      if (rootElement.dataset.arianaTextLogo) {
        setTextLogoUrl(rootElement.dataset.arianaTextLogo);
      }
    }

    // Detect VSCode theme
    const detectTheme = () => {
      // Request theme info from the extension
      vscode.postMessage({ command: 'getTheme' });
      
      // Also try to detect from CSS variables as a fallback
      const isDark = document.body.classList.contains('vscode-dark') || 
                    window.matchMedia('(prefers-color-scheme: dark)').matches;
      setTheme(isDark ? 'dark' : 'light');
    };

    // Handle messages from the extension
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      switch (message.type) {
        case 'traces':
          setTraces(message.value);
          // When traces are received, switch to the traces tab
          setActiveTab('traces');
          break;
        case 'theme':
          setTheme(message.value);
          break;
        case 'themeChange':
          // Force a complete re-render by updating state
          setTheme(prev => prev === 'light' ? 'dark' : 'light');
          // Then detect the actual theme
          setTimeout(() => detectTheme(), 0);
          break;
      }
    };

    // Set up message handlers
    const highlightRequest: HighlightRequest = (file, startLine, startCol, endLine, endCol) => {
      console.log('Requesting highlight', file, startLine, startCol, endLine, endCol);
      vscode.postMessage({
        command: 'highlight',
        file,
        startLine,
        startCol,
        endLine,
        endCol
      });
    };
    setRequestHighlight(() => highlightRequest);

    // Add event listener for messages from extension
    window.addEventListener('message', handleMessage);
    
    // Detect theme on mount
    detectTheme();
    
    // Clean up
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Force a re-render when theme changes
  useEffect(() => {
    setKey(prev => prev + 1);
  }, [theme]);

  // Handle logo clicks for secret panel activation
  const handleLogoClick = () => {
    const now = Date.now();
    setLogoClicks(prev => {
      // Filter clicks that happened in the last second
      const recentClicks = [...prev.filter(time => now - time < 1000), now];
      
      // If we have 5 clicks within 1 second, show the color tab
      if (recentClicks.length >= 5) {
        setShowColorTab(true);
        return [];
      }
      
      return recentClicks;
    });
  };

  return (
    <div key={key} className="flex flex-col h-screen overflow-hidden" style={{
    //   backgroundColor: 'var(--background)',
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
            
            <TabsContent value="main" className="flex-1 h-[97%] max-h-[97%] mt-0">
              <MainTab textLogoUrl={textLogoUrl} onLogoClick={handleLogoClick} />
            </TabsContent>
            
            <TabsContent value="traces" className="flex-1 overflow-auto mt-0">
              <TracesTab traces={traces} requestHighlight={requestHighlight} />
            </TabsContent>

            {showColorTab && (
              <TabsContent value="colors" className="flex-1 overflow-auto mt-0">
                <ColorVisualizerTab />
              </TabsContent>
            )}
          </Tabs>
        </div>
      ) : (
        // Regular webview (not sidebar)
        <TracesTab traces={traces} requestHighlight={requestHighlight} />
      )}
    </div>
  );
};

export default App;