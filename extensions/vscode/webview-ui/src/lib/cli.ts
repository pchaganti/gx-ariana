export interface ArianaCliStatus {
    isInstalled: boolean;
    version?: string;
    latestVersion?: string;
    needsUpdate: boolean;
    npmAvailable: boolean;
    pipAvailable: boolean;
    pythonPipAvailable: boolean;
    python3PipAvailable: boolean;
}