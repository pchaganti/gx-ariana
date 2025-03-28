import * as vscode from 'vscode';
import { exec } from 'child_process';

// Add this enum for installation methods
export enum ArianaInstallMethod {
    NPM = 'npm',
    PIP = 'pip',
    PYTHON_PIP = 'python -m pip',
    PYTHON3_PIP = 'python3 -m pip',
    UNKNOWN = 'unknown'
}

export async function handleArianaInstallation(context: vscode.ExtensionContext) {
    let arianaExists = await checkCommandExists('ariana');

    if (arianaExists) return

    const npmExists = await checkCommandExists('npm');
    if (npmExists) {
        const answer = await vscode.window.showInformationMessage(
            'The Ariana extension requires the "ariana" command. Would you like to install it with npm?',
            'Yes', 'No'
        );
        
        if (answer === 'Yes') {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Installing Ariana...',
                cancellable: false
            }, async () => {
                await executeCommand('npm i -g ariana');
                // Save the installation method
                await context.globalState.update('arianaInstallMethod', ArianaInstallMethod.NPM);
            });
        } else {
            showInstallationRequired();
        }
        return;
    }

    const pipCommands = [
        { cmd: 'pip', method: ArianaInstallMethod.PIP },
        { cmd: 'python -m pip', method: ArianaInstallMethod.PYTHON_PIP },
        { cmd: 'python3 -m pip', method: ArianaInstallMethod.PYTHON3_PIP }
    ];
    
    for (const { cmd, method } of pipCommands) {
        if (await checkCommandExists(cmd.split(' ')[0])) {
            const answer = await vscode.window.showInformationMessage(
                `The Ariana extension requires the "ariana" command. Would you like to install it with ${cmd}?`,
                'Yes', 'No'
            );
            
            if (answer === 'Yes') {
                await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: 'Installing Ariana...',
                    cancellable: false
                }, async () => {
                    await executeCommand(`${cmd} install ariana`);
                    // Save the installation method
                    await context.globalState.update('arianaInstallMethod', method);
                });
            } else {
                showInstallationRequired();
            }
            break;
        }
    }
}

export async function updateArianaCLI(context: vscode.ExtensionContext): Promise<void> {
    const installMethod = context.globalState.get<ArianaInstallMethod>('arianaInstallMethod');
    
    // Only proceed if we know how it was installed
    if (!installMethod || installMethod === ArianaInstallMethod.UNKNOWN) {
        return;
    }

    const updateCommand = installMethod === ArianaInstallMethod.NPM
        ? 'npm i -g ariana@latest'
        : `${installMethod} install --upgrade ariana`;

    try {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Updating Ariana CLI...',
            cancellable: false
        }, async () => {
            await executeCommand(updateCommand);
        });
        
        vscode.window.showInformationMessage('Ariana CLI has been updated successfully!');
    } catch (error) {
        vscode.window.showErrorMessage(
            `Failed to update Ariana CLI: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
    }
}

function showInstallationRequired() {
    vscode.window.showErrorMessage(
        'The Ariana command is required for the extension to work. Please check installation instructions.',
        'View Instructions'
    ).then(selection => {
        if (selection === 'View Instructions') {
            vscode.env.openExternal(vscode.Uri.parse('https://github.com/dedale-dev/ariana?tab=readme-ov-file#2-install-the-ariana-cli'));
        }
    });
}

async function checkCommandExists(command: string): Promise<boolean> {
    try {
        const which = process.platform === 'win32' ? 'where' : 'which';
        await executeCommand(`${which} ${command.split(' ')[0]}`);
        return true;
    } catch {
        return false;
    }
}

async function executeCommand(command: string): Promise<string> {
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