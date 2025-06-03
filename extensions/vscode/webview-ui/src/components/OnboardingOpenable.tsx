import React from 'react';
import { cn } from '../lib/utils';
import { postMessageToExtension } from '../utils/vscode';
import stateManager from '../utils/stateManager';
import { ArianaCliStatus } from '../lib/cli';
import { useTheme } from '../hooks/useTheme';



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
  const { isDark } = useTheme();
  return (
    <div className={cn(
      "flex relative not-last:pb-8",
      active ? "opacity-100" : "opacity-60"
    )}>
      <div className={cn(
        "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ",
        completed
          ? "bg-[var(--success-base)] text-[var(--text-on-emphasis)]"
          : isDark
            ? "bg-[var(--interactive-active)] text-white"
            : "bg-[var(--interactive-active)] text-[var(--text-on-emphasis)]"
      )}>
        {completed ? "✓" : number}
      </div>
      <div className="flex-grow pl-4 w-full">
        <h3 className="text-lg font-semibold mb-1 text-[var(--text-default)]">{title}</h3>
        {description && <p className="text-[var(--text-muted)]">{description}</p>}
        {children && (
          <div className="mt-2 w-full">
            {children}
          </div>
        )}
      </div>
      {number < 4 && (
        <div className={cn(
          "absolute left-5 top-10 w-0.5",
          completed ? "bg-[var(--success-base)]" : "bg-[var(--interactive-active)]"
        )} style={{ height: 'calc(100% - 29px)' }} />
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
  const { isDark } = useTheme();
  return (
    <div className="mt-2">
      <div className={cn(
        "p-3 rounded-t-md font-mono text-sm",
        available
          ? isDark
            ? "bg-[var(--surface-code)] text-[var(--text-default)]"
            : "bg-[var(--surface-code)] text-[var(--text-default)]"
          : "bg-[var(--surface-raised)] text-[var(--text-default)] opacity-50"
      )}>
        {command}
      </div>
      {available ? (
        <button
          className="w-full p-2 bg-[var(--interactive-default)] hover:bg-[var(--interactive-hover)] text-[var(--text-default)] rounded-b-md hover:bg-opacity-90 transition-colors cursor-pointer"
          onClick={() => onInstall(method)}
        >
          Run in Terminal
        </button>
      ) : (
        <div className="w-full p-2 bg-[var(--surface-raised)] text-[var(--text-default)] rounded-b-md text-center">
          {method} not available
        </div>
      )}
    </div>
  );
};

interface OnboardingProps {
  cliStatus: ArianaCliStatus | null;
  handleInstall: (method: ArianaInstallMethod) => void;
  isDark: boolean;
}

const Onboarding: React.FC<OnboardingProps> = ({ cliStatus, handleInstall, isDark }) => {
  return (
    <div className="px-4 pt-2 pb-10 mt-2">
      <div className="space-y-2">
        <OnboardingStep
          number={1}
          title="Install Ariana CLI"
          active={true}
          completed={cliStatus?.isInstalled}
        >
          {cliStatus?.isInstalled ? (
            <p className="text-[var(--text-muted)]">Ariana CLI is installed. {cliStatus.version && `Version: ${cliStatus.version.split('ariana ')[1]}`}</p>
          ) : (
            <div className="space-y-4">
              <p className="text-[var(--text-muted)]">Install the Ariana CLI to allow Ariana to observe your code.</p>
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
          title="Observe your code running with Ariana"
          active={cliStatus?.isInstalled || false}
        >
          <div className="flex flex-col gap-2 text-[var(--text-muted)]">
            <p>The Ariana CLI will insert various instrumentation code snippets in a copy of your codebase under a new .ariana sub-directory of your working directory. Then it will run your command in that sub-directory and observe the modified code running.</p>
            <p className="">Therefore, Ariana must transform your code before it builds and then watch it run. So build & run your code from the terminal as you normally would, but add <span className="text-[var(--interactive-active)] bg-[var(--surface-code)] py-0.5 px-1 rounded-md font-mono">ariana</span> before the command.</p>
            <div className={cn(
              "p-3 my-2 rounded-md font-mono text-[var(--text-default)]",
              isDark ? "bg-[var(--surface-code)]" : "bg-[var(--surface-code)]"
            )}>
              ariana <span className="text-[var(--interactive-active)]">{'<your build & run command>'}</span>
            </div>
            <p className="text-[var(--text-muted)]">Examples:</p>
            <div className="flex my-2 flex-col gap-2">
              <div className={cn(
                "p-3 rounded-md font-mono text-[var(--text-default)]",
                isDark ? "bg-[var(--surface-code)]" : "bg-[var(--surface-code)]"
              )}>
                ariana <span className="text-[var(--interactive-active)]">python my_script.py</span>
              </div>
              <div className={cn(
                "p-3 rounded-md font-mono text-[var(--text-default)]",
                isDark ? "bg-[var(--surface-code)]" : "bg-[var(--surface-code)]"
              )}>
                ariana <span className="text-[var(--interactive-active)]">npm run dev</span>
              </div>
            </div>
            <p className="text-[var(--text-muted)]">Do the above in multiple terminal windows for each module of your code you want to run.</p>
            <p className="text-[var(--text-muted)]">Examples:</p>
            <div className="flex my-2 flex-col gap-2">
              <div className={cn(
                "p-3 rounded-md font-mono text-[var(--text-default)]",
                isDark ? "bg-[var(--surface-code)]" : "bg-[var(--surface-code)]"
              )}>
                <span className="text-[var(--text-muted)]">cd frontend/</span>
                <br />
                ariana <span className="text-[var(--interactive-active)]">npm run dev</span>
              </div>
              <div className={cn(
                "p-3 rounded-md font-mono text-[var(--text-default)]",
                isDark ? "bg-[var(--surface-code)]" : "bg-[var(--surface-code)]"
              )}>
                <span className="text-[var(--text-muted)]">cd backend/</span>
                <br />
                ariana <span className="text-[var(--interactive-active)]">uv run server.py</span>
              </div>
            </div>
            <p className="text-[var(--text-muted)]">If building & running requires 2 or more commands, either create a script and run it with <div className="inline p-1 rounded-md font-mono bg-[var(--surface-code)] text-[var(--interactive-active)]">ariana {'./<my_script>'}</div>, or open a new shell with <div className="inline p-1 rounded-md font-mono bg-[var(--surface-code)] text-[var(--interactive-active)]">ariana bash</div> on linux/macOS or <div className="inline p-1 rounded-md font-mono bg-[var(--surface-code)] text-[var(--interactive-active)]">ariana powershell.exe</div> on Windows, and run your commands there.</p>
            
            <div className="text-lg mt-2 font-semibold italic text-[var(--text-muted)]">What if my code cannot be ran from the .ariana sub-directory?</div>
            <p className="text-[var(--text-muted)]">You can use the <div className="inline p-1 rounded-md font-mono bg-[var(--surface-code)] text-[var(--interactive-active)]">--inplace</div> flag to instrument the original code instead (no copy is made, your code is heavily modified and is then restored after Ariana stops running).</p>
            <p className="text-[var(--text-muted)]">Examples:</p>
            <div className="flex my-2 flex-col gap-2">
              <div className={cn(
                "p-3 rounded-md font-mono text-[var(--text-default)]",
                isDark ? "bg-[var(--surface-code)]" : "bg-[var(--surface-code)]"
              )}>
                ariana --inplace <span className="text-[var(--interactive-active)]">python my_script.py</span>
              </div>
              <div className={cn(
                "p-3 rounded-md font-mono text-[var(--text-default)]",
                isDark ? "bg-[var(--surface-code)]" : "bg-[var(--surface-code)]"
              )}>
                ariana --inplace <span className="text-[var(--interactive-active)]">npm run dev</span>
              </div>
            </div>
          </div>
        </OnboardingStep>

        <OnboardingStep
          number={3}
          title="View and analyze traces"
          active={cliStatus?.isInstalled || false}
        >
          <div className="space-y-4 text-[var(--text-muted)]">
            <p className="text-[var(--text-muted)]">After running your code with Ariana, select the run in the "Runs Observed" tab to view execution traces.</p>
            <p className="text-[var(--text-muted)]">Click on a trace to highlight the corresponding code in your editor.</p>
          </div>
        </OnboardingStep>

        <OnboardingStep
          number={4}
          title="Any issue?"
          active={cliStatus?.isInstalled || false}
        >
          <div className="space-y-4 text-[var(--text-muted)]">
            <p className="text-[var(--text-muted)]">Join <a className="text-[var(--interactive-default)] hover:underline" href="https://discord.gg/Y3TFTmE89g">our Discord community</a> to connect with other developers and get help with Ariana.</p>
          </div>
        </OnboardingStep>
      </div>
    </div>
  );
};

interface OnboardingOpenableProps {
  cliStatus: ArianaCliStatus | null;
}

const OnboardingOpenable: React.FC<OnboardingOpenableProps> = ({ cliStatus }) => {
  const { isDark } = useTheme();

  // Use state manager for persisting collapsed state
  const [isOpened, setIsOpened] = stateManager.usePersistedState<boolean>('isOnboardingOpened', false);

  // Save collapsed state
  const handleToggleOpened = () => {
    const newState = !isOpened;
    setIsOpened(newState);
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
    <button onClick={(e) => {
      if (!isOpened) {
        e.stopPropagation();
        handleToggleOpened();
      }
    }} className={cn(
      "group w-full transition-all flex flex-col text-left",
      isOpened ? "h-fit p-0 select-text cursor-text" : "h-[15em] hover:p-0.5 p-1 cursor-pointer select-text"
    )}>
      <div className={cn(
        "relative rounded-2xl h-full w-full shadow-[0_5px_5px_3px_var(--bg-600)]",
        isDark ? "bg-[var(--bg-400)]" : "bg-[var(--bg-550)]",
        isOpened ? "" : "overflow-hidden"
      )}>
        {/* close button only active & visible when opened at the top right */}
        <div className="absolute top-0 left-0 w-full h-full p-2">
          <button onClick={handleToggleOpened} className={cn(
            "sticky flex items-center top-2 left-full z-50 cursor-pointer rounded-xl bg-[var(--bg-base)] hover:bg-[var(--interactive-active)] hover:text-[var(--bg-base)] p-1 transition-all",
            isOpened ? "opacity-100" : "opacity-0"
          )}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" className="size-5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className={cn(
          "absolute w-full h-full bg-transparent z-40 transition-all",
          isDark ? "inset-shadow-[0_10px_20px_5px_var(--bg-200)] hover:inset-shadow-[0_20px_40px_10px_var(--bg-200)]" : "inset-shadow-[0_10px_20px_5px_var(--bg-700)] hover:inset-shadow-[0_20px_40px_10px_var(--bg-700)]",
          isOpened ? "opacity-0 pointer-events-none" : "opacity-100"
        )}>
        </div>
        <div className={cn(
          "absolute z-30 w-full h-full flex flex-col justify-end px-7 py-6 transition-all",
          isOpened ? "opacity-0 pointer-events-none" : "opacity-100"
        )}
        >
          <div className={cn(
            "text-2xl font-bold transition-all",
            isDark ? "text-[var(--text-default)]" : "text-[var(--bg-200)]"
          )}>
            🗺️ Getting Started with Ariana
          </div>
        </div>
        <div className={cn(
          "absolute z-20 w-full h-full bg-[var(--info-base)] transition-all",
          isOpened ? "opacity-0 pointer-events-none" : "opacity-100"
        )}
          style={{
            maskImage: "linear-gradient(to bottom, rgba(0, 0, 0, 0), rgba(0, 0, 0, 1))"
          }}
        >
        </div>
        <div className={cn(
          "absolute z-10 w-full h-full bg-transparent backdrop-blur-[2px] group-hover:backdrop-blur-[1px] transition-all",
          isOpened ? "opacity-0 pointer-events-none" : "opacity-100"
        )}></div>
        <Onboarding cliStatus={cliStatus} handleInstall={handleInstall} isDark={isDark} />
      </div>
    </button>
  );
};

export default OnboardingOpenable;
