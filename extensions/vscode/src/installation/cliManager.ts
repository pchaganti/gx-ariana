import * as vscode from 'vscode';
import { exec } from 'child_process';
import * as https from 'https';

// Add this enum for installation methods
export enum ArianaInstallMethod {
    NPM = 'npm',
    PIP = 'pip',
    PYTHON_PIP = 'python -m pip',
    PYTHON3_PIP = 'python3 -m pip',
    UNKNOWN = 'unknown'
}

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

/**
 * Check if a command exists in the system
 */
export async function checkCommandExists(command: string): Promise<boolean> {
    try {
        const which = process.platform === 'win32' ? 'where' : 'which';
        await executeCommand(`${which} ${command.split(' ')[0]}`);
        return true;
    } catch {
        return false;
    }
}

/**
 * Execute a shell command
 */
export async function executeCommand(command: string): Promise<string> {
    return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
            if (error) {
                reject(error);
                return;
            }
            resolve(stdout.trim());
        });
    });
}

/**
 * Get the latest version of Ariana from PyPI
 */
async function getLatestPyPIVersion(): Promise<string> {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'pypi.org',
            path: '/pypi/ariana/json',
            method: 'GET'
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve(json.info.version);
                } catch (error) {
                    reject(error);
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.end();
    });
}

/**
 * Get the latest version of Ariana from npm
 */
async function getLatestNpmVersion(): Promise<string> {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'registry.npmjs.org',
            path: '/ariana',
            method: 'GET'
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve(json['dist-tags'].latest);
                } catch (error) {
                    reject(error);
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.end();
    });
}

/**
 * Compare two semantic version strings
 * Returns true if version1 is less than version2
 */
function isVersionLessThan(version1: string, version2: string): boolean {
    const v1Parts = version1.split('.').map(Number);
    const v2Parts = version2.split('.').map(Number);
    
    for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
        const v1 = v1Parts[i] || 0;
        const v2 = v2Parts[i] || 0;
        
        if (v1 < v2) {
            return true;
        }
        if (v1 > v2) {
            return false;
        }
    }
    
    return false; // Versions are equal
}

/**
 * Get the current status of the Ariana CLI
 */
export async function getArianaCliStatus(): Promise<ArianaCliStatus> {
    const status: ArianaCliStatus = {
        isInstalled: false,
        needsUpdate: false,
        npmAvailable: false,
        pipAvailable: false,
        pythonPipAvailable: false,
        python3PipAvailable: false
    };

    // Check if ariana is installed
    status.isInstalled = await checkCommandExists('ariana');

    // Check for available installation methods
    status.npmAvailable = await checkCommandExists('npm');
    status.pipAvailable = await checkCommandExists('pip');
    status.pythonPipAvailable = await checkCommandExists('python');
    status.python3PipAvailable = await checkCommandExists('python3');

    // If ariana is installed, get its version
    if (status.isInstalled) {
        try {
            const versionOutput = await executeCommand('ariana --version');
            status.version = versionOutput.trim();
            
            // Check for the latest version from the appropriate registry
            try {
                // Determine if Ariana was installed via npm or pip
                // First try to get the npm package info
                const npmPackageInfo = await executeCommand('npm list -g ariana');
                
                if (npmPackageInfo.includes('ariana@')) {
                    // Ariana was installed via npm
                    status.latestVersion = await getLatestNpmVersion();
                } else {
                    // Assume Ariana was installed via pip
                    status.latestVersion = await getLatestPyPIVersion();
                }
                
                // Check if an update is needed
                if (status.version && status.latestVersion) {
                    status.needsUpdate = isVersionLessThan(status.version, status.latestVersion);
                }
            } catch (error) {
                console.error('Error checking for latest version:', error);
            }
        } catch (error) {
            console.error('Error getting ariana version:', error);
        }
    }

    return status;
}

/**
 * Install Ariana CLI using the specified method
 */
export async function installArianaCli(method: ArianaInstallMethod, context: vscode.ExtensionContext): Promise<boolean> {
    try {
        let installCommand = '';
        
        switch (method) {
            case ArianaInstallMethod.NPM:
                installCommand = 'npm i -g ariana';
                break;
            case ArianaInstallMethod.PIP:
                installCommand = 'pip install ariana';
                break;
            case ArianaInstallMethod.PYTHON_PIP:
                installCommand = 'python -m pip install ariana';
                break;
            case ArianaInstallMethod.PYTHON3_PIP:
                installCommand = 'python3 -m pip install ariana';
                break;
            default:
                return false;
        }
        
        await executeCommand(installCommand);
        
        // Save the installation method
        await context.globalState.update('arianaInstallMethod', method);
        
        return true;
    } catch (error) {
        console.error('Error installing ariana:', error);
        return false;
    }
}

/**
 * Update Ariana CLI
 */
export async function updateArianaCli(context: vscode.ExtensionContext): Promise<boolean> {
    const installMethod = context.globalState.get<ArianaInstallMethod>('arianaInstallMethod');
    
    // Only proceed if we know how it was installed
    if (!installMethod || installMethod === ArianaInstallMethod.UNKNOWN) {
        // Try to determine installation method
        try {
            // Check if it was installed via npm
            const npmPackageInfo = await executeCommand('npm list -g ariana');
            if (npmPackageInfo.includes('ariana@')) {
                await context.globalState.update('arianaInstallMethod', ArianaInstallMethod.NPM);
                const updateCommand = 'npm i -g ariana@latest';
                await executeCommand(updateCommand);
                return true;
            }
            
            // If not npm, try pip
            if (await checkCommandExists('pip')) {
                await context.globalState.update('arianaInstallMethod', ArianaInstallMethod.PIP);
                const updateCommand = 'pip install --upgrade ariana';
                await executeCommand(updateCommand);
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('Error determining installation method:', error);
            return false;
        }
    }

    const updateCommand = installMethod === ArianaInstallMethod.NPM
        ? 'npm i -g ariana@latest'
        : `${installMethod} install --upgrade ariana`;

    try {
        await executeCommand(updateCommand);
        return true;
    } catch (error) {
        console.error('Error updating ariana:', error);
        return false;
    }
}
