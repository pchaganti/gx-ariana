import React from 'react';
import { cn } from '../lib/utils';
import { postMessageToExtension } from '../utils/vscode';
import stateManager from '../utils/stateManager';
import { ArianaCliStatus } from '../lib/cli';
import { useTheme } from '../hooks/useTheme';
import { colors, getThemeAwareColor } from '../utils/themeAwareColors';

// Define enum for installation methods
enum ArianaInstallMethod {
	NPM = 'npm',
	PIP = 'pip',
	PYTHON_PIP = 'python -m pip',
	PYTHON3_PIP = 'python3 -m pip',
	UNKNOWN = 'unknown'
}

interface OnboardingStepProps {
	number: number;
	title: string;
	description?: string;
	active: boolean;
	completed?: boolean;
	children?: React.ReactNode;
}

const OnboardingStep: React.FC<OnboardingStepProps> = ({
	number,
	title,
	description,
	active,
	completed,
	children
}) => {
	return (
		<div className={cn(
			"flex relative not-last:pb-8",
			active ? "opacity-100" : "opacity-60"
		)}>
			<div className={cn(
				"flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg relative z-10",
				completed ? "bg-[var(--vscode-warning-500)] text-[var(--vscode-foreground)]" : "bg-[var(--vscode-accent-500)] text-[var(--vscode-foreground)]"
			)}>
				{completed ? "✓" : number}
			</div>
			<div className="flex-grow pl-4 w-full">
				<h3 className="text-lg font-semibold mb-1 text-[var(--vscode-foreground)]">{title}</h3>
				{description && <p className="text-[var(--vscode-foreground)] opacity-70">{description}</p>}
				{children && (
					<div className="mt-2 w-full">
						{children}
					</div>
				)}
			</div>
			{number < 4 && (
				<div className="absolute left-5 top-10 w-0.5 bg-[var(--vscode-accent-500)] text-[var(--vscode-foreground)]" style={{ height: 'calc(100% - 29px)' }} />
			)}
		</div>
	);
};

interface InstallOptionProps {
	method: ArianaInstallMethod;
	command: string;
	available: boolean;
	onInstall: (method: ArianaInstallMethod) => void;
}

const InstallOption: React.FC<InstallOptionProps> = ({ method, command, available, onInstall }) => {
	return (
		<div className="mt-2">
			<div className={cn(
				"p-3 rounded-t-md font-mono text-sm",
				available ? "bg-[var(--vscode-secondary-500)] text-[var(--vscode-foreground)]" : "bg-[var(--vscode-secondary-500)] text-[var(--vscode-foreground)] opacity-50"
			)}>
				{command}
			</div>
			{available ? (
				<button 
					className="w-full p-2 bg-[var(--vscode-secondary-500)] hover:bg-[var(--vscode-accent-500)] text-[var(--vscode-foreground)] rounded-b-md hover:bg-opacity-90 transition-colors cursor-pointer"
					onClick={() => onInstall(method)}
				>
					Run in Terminal
				</button>
			) : (
				<div className="w-full p-2 bg-[var(--vscode-secondary-500)] text-[var(--vscode-foreground)] rounded-b-md text-center">
					{method} not available
				</div>
			)}
		</div>
	);
};

interface OnboardingPanelProps {
  cliStatus: ArianaCliStatus | null;
}

const OnboardingPanel: React.FC<OnboardingPanelProps> = ({ cliStatus }) => {
  const { isDark } = useTheme();
	// Use state manager for persisting collapsed state
	const [isCollapsed, setIsCollapsed] = stateManager.usePersistedState<boolean>('isOnboardingCollapsed', false);

	// Save collapsed state
	const handleToggleCollapse = () => {
		const newState = !isCollapsed;
		setIsCollapsed(newState);
		localStorage.setItem('ariana-has-seen-onboarding', newState.toString());
	};

	// Handle installation
	const handleInstall = (method: ArianaInstallMethod) => {
		postMessageToExtension({ 
			command: 'installArianaCli',
			method: method
		});
	};

	return (
    <div className="rounded-md bg-[var(--vscode-background)]">
      <div
        className={"group sticky top-0 z-20 flex items-center justify-between px-4 py-3 bg-[var(--vscode-background)] cursor-pointer hover:bg-[var(--vscode-secondary-500)] transition-colors rounded-sm " + (isCollapsed ? '' : 'border-solid border-b-2 border-[var(--vscode-secondary-500)] rounded-b-none')}
        onClick={handleToggleCollapse}
      >
        <h2 className="text-lg font-semibold text-[var(--vscode-foreground)] opacity-70 group-hover:opacity-100">👋 Getting Started {isDark ? 'dark' : 'light'}</h2>
        <div className={"h-3 w-3 group-hover:bg-[var(--vscode-accent-500)] " + (isCollapsed ? 'rounded-full bg-[var(--vscode-secondary-500)]' : 'rounded-xs bg-[var(--vscode-secondary-500)]')}>
        </div>
      </div>

      {!isCollapsed && (
        <div className="px-4 pt-2 pb-10 mt-2">
          <div className="space-y-2">
            <OnboardingStep
              number={1}
              title="Install Ariana CLI"
              active={true}
              completed={cliStatus?.isInstalled}
            >
              {cliStatus?.isInstalled ? (
                <p style={{ color: getThemeAwareColor(colors.text.onEmphasis, isDark) }}>Ariana CLI is not installed.</p>
              ) : (
                <div className="space-y-4">
                  <p style={{ color: getThemeAwareColor(colors.text.default, isDark) }}>Install the Ariana CLI to allow Ariana to run with your code. (Ariana will create a copy of your JS, TS or Python code, rewritten with instrumentation, will run that copy and spy on its execution.)</p>
                  <p style={{ color: getThemeAwareColor(colors.text.onEmphasis, isDark) }}>Choose your preferred installation method:</p>
                  {cliStatus && (
                    <div className="space-y-4">
                      {cliStatus.npmAvailable && (
                        <InstallOption 
                          method={ArianaInstallMethod.NPM} 
                          command="npm install -g ariana" 
                          available={cliStatus.npmAvailable}
                          onInstall={handleInstall}
                        />
                      )}
                      
                      {cliStatus.pipAvailable && (
                        <InstallOption 
                          method={ArianaInstallMethod.PIP} 
                          command="pip install ariana" 
                          available={cliStatus.pipAvailable}
                          onInstall={handleInstall}
                        />
                      )}
                      
                      {cliStatus.pythonPipAvailable && (
                        <InstallOption 
                          method={ArianaInstallMethod.PYTHON_PIP} 
                          command="python -m pip install ariana" 
                          available={cliStatus.pythonPipAvailable}
                          onInstall={handleInstall}
                        />
                      )}
                      
                      {cliStatus.python3PipAvailable && (
                        <InstallOption 
                          method={ArianaInstallMethod.PYTHON3_PIP} 
                          command="python3 -m pip install ariana" 
                          available={cliStatus.python3PipAvailable}
                          onInstall={handleInstall}
                        />
                      )}
                    </div>
                  )}
                </div>
              )}
            </OnboardingStep>

            <OnboardingStep
              number={2}
              title="Run your code with Ariana"
              active={cliStatus?.isInstalled || false}
            >
              <div className="flex flex-col gap-2" style={{ color: getThemeAwareColor(colors.text.muted, isDark) }}>
                <p className="">Ariana must watch your code both build & run. So build & run your code from the terminal as you normally would, but add <span className="text-[var(--vscode-accent-500)] font-mono">ariana</span> before the command.</p>
                <div className="p-3 my-2 rounded-md font-mono" style={{ backgroundColor: getThemeAwareColor(colors.background.secondary, isDark), color: getThemeAwareColor(colors.text.default, isDark) }}>
                  <span style={{ color: getThemeAwareColor(colors.text.onEmphasis, isDark) }}>{'<your build & run command>'}</span>
                </div>
                <p className="font-semibold italic" style={{ color: getThemeAwareColor(colors.text.muted, isDark) }}>Ariana supports JS, TS & Python at the moment.</p>
                <p style={{ color: getThemeAwareColor(colors.text.onEmphasis, isDark) }}>Run the command:</p>
                <div className="flex my-2 flex-col gap-2">
                  <div className="p-3 rounded-md font-mono" style={{ backgroundColor: 'var(--surface-code)', color: getThemeAwareColor(colors.text.default, isDark) }}>
                    <span style={{ color: getThemeAwareColor(colors.text.onEmphasis, isDark) }}>python my_script.py</span>
                  </div>
                  <div className="p-3 rounded-md font-mono" style={{ backgroundColor: 'var(--surface-code)', color: getThemeAwareColor(colors.text.default, isDark) }}>
                    <span style={{ color: getThemeAwareColor(colors.text.onEmphasis, isDark) }}>npm run dev</span>
                  </div>
                </div>
                <p style={{ color: getThemeAwareColor(colors.text.muted, isDark) }}>Do the above in multiple terminal windows for each module of your code you want to run.</p>
                <p style={{ color: getThemeAwareColor(colors.text.onEmphasis, isDark) }}>Run the command:</p>
                <div className="flex my-2 flex-col gap-2">
                  <div className="p-3 rounded-md font-mono" style={{ backgroundColor: 'var(--surface-code)', color: getThemeAwareColor(colors.text.default, isDark) }}>
                    <span style={{ color: getThemeAwareColor(colors.text.subtle, isDark) }}>cd frontend/</span>
                    <br />
                    <span style={{ color: getThemeAwareColor(colors.text.onEmphasis, isDark) }}>npm run dev</span>
                  </div>
                  <div className="p-3 rounded-md font-mono" style={{ backgroundColor: 'var(--surface-code)', color: getThemeAwareColor(colors.text.default, isDark) }}>
                    <span style={{ color: getThemeAwareColor(colors.text.subtle, isDark) }}>cd backend/</span>
                    <br />
                    <span style={{ color: getThemeAwareColor(colors.text.onEmphasis, isDark) }}>uv run server.py</span>
                  </div>
                </div>
                <p style={{ color: getThemeAwareColor(colors.text.muted, isDark) }}>If building & running requires 2 or more commands, either create a script and run it with <span className="inline p-1 rounded-md font-mono" style={{ backgroundColor: 'var(--surface-code)', color: getThemeAwareColor(colors.text.onEmphasis, isDark) }}>ariana ./my_script</span>, or open a new shell with <span className="inline p-1 rounded-md font-mono" style={{ backgroundColor: 'var(--surface-code)', color: getThemeAwareColor(colors.text.onEmphasis, isDark) }}>ariana bash</span> on linux/macOS or <span className="inline p-1 rounded-md font-mono" style={{ backgroundColor: 'var(--surface-code)', color: getThemeAwareColor(colors.text.onEmphasis, isDark) }}>ariana powershell.exe</span> on Windows, and run your commands there.</p>
              </div>
            </OnboardingStep>

            <OnboardingStep
              number={3}
              title="View and analyze traces"
              active={cliStatus?.isInstalled || false}
            >
              <div className="space-y-4" style={{ color: getThemeAwareColor(colors.text.muted, isDark) }}>
                <p style={{ color: getThemeAwareColor(colors.text.muted, isDark) }}>After running your code with Ariana, switch to the <b>Analyze</b> tab to view execution traces.</p>
                <p style={{ color: getThemeAwareColor(colors.text.muted, isDark) }}>Click on a trace to highlight the corresponding code in your editor.</p>
              </div>
            </OnboardingStep>

            <OnboardingStep
              number={4}
              title="Any issue?"
              active={cliStatus?.isInstalled || false}
            >
              <div className="space-y-4" style={{ color: getThemeAwareColor(colors.text.muted, isDark) }}>
                <p style={{ color: getThemeAwareColor(colors.text.muted, isDark) }}>Join <a className="text-[var(--vscode-accent-500)] hover:underline" href="https://discord.gg/Y3TFTmE89g">our Discord community</a> to connect with other developers and get help with Ariana.</p>
              </div>
            </OnboardingStep>
          </div>
        </div>
      )}

    </div>
	);
};

export default OnboardingPanel;
