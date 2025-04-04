import React, { useState, useEffect } from 'react';
import { cn } from '../lib/utils';
import { getVSCodeAPI, postMessageToExtension } from '../utils/vscode';

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
			"flex relative not-last:pb-12",
			active ? "opacity-100" : "opacity-60"
		)}>
			<div className={cn(
				"flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg relative z-10",
				completed ? "bg-green-600 text-white" : "bg-[var(--accent)] text-[var(--fg-3)]"
			)}>
				{completed ? "✓" : number}
			</div>
			<div className="flex-grow pl-4 w-full">
				<h3 className="text-lg font-medium mb-1 text-[var(--fg-0)]">{title}</h3>
				{description && <p className="text-[var(--fg-2)]">{description}</p>}
				{children && (
					<div className="mt-2 w-full">
						{children}
					</div>
				)}
			</div>
			{number < 3 && (
				<div className="absolute left-5 top-10 w-0.5 bg-[var(--accent)] text-[var(--fg-3)]" style={{ height: 'calc(100% - 32px)' }} />
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
				"p-3 rounded-md font-mono text-sm",
				available ? "bg-[var(--bg-1)] text-[var(--fg-1)]" : "bg-[var(--bg-1)] text-[var(--fg-3)] opacity-50"
			)}>
				{command}
			</div>
			{available ? (
				<button 
					className="mt-2 w-full p-2 bg-[var(--accent)] text-[var(--fg-3)] rounded-md hover:bg-opacity-90 transition-colors"
					onClick={() => onInstall(method)}
				>
					Run in Terminal
				</button>
			) : (
				<div className="mt-2 w-full p-2 bg-[var(--bg-2)] text-[var(--fg-3)] rounded-md text-center">
					{method} not available
				</div>
			)}
		</div>
	);
};

interface OnboardingTabProps {
	textLogoUrl: string;
	onLogoClick?: () => void;
}

const OnboardingTab: React.FC<OnboardingTabProps> = ({ textLogoUrl, onLogoClick }) => {
	const [isCollapsed, setIsCollapsed] = useState(false);
	const [renderKey, setRenderKey] = useState(0);
	const [cliStatus, setCliStatus] = useState<ArianaCliStatus | null>(null);

	// Check if user has seen the onboarding before
	useEffect(() => {
		const hasSeenOnboarding = localStorage.getItem('ariana-has-seen-onboarding');
		if (hasSeenOnboarding === 'true') {
			setIsCollapsed(true);
		}
	}, []);

	// Request Ariana CLI status on mount
	useEffect(() => {
		postMessageToExtension({ command: 'getArianaCliStatus' });
	}, []);

	// Force rerender when theme changes
	useEffect(() => {
		const handleThemeChange = () => {
			setRenderKey(prev => prev + 1);
		};

		const handleMessage = (event: MessageEvent) => {
			const message = event.data;
			if (message.type === 'themeChange') {
				handleThemeChange();
			} else if (message.type === 'arianaCliStatus') {
				setCliStatus(message.value);
			}
		};

		window.addEventListener('message', handleMessage);

		return () => {
			window.removeEventListener('message', handleMessage);
		};
	}, []);

	// Save collapsed state
	const handleToggleCollapse = () => {
		const newState = !isCollapsed;
		setIsCollapsed(newState);
		if (newState) {
			localStorage.setItem('ariana-has-seen-onboarding', 'true');
		}
	};

	// Handle installation
	const handleInstall = (method: ArianaInstallMethod) => {
		postMessageToExtension({ 
			command: 'installArianaCli',
			method: method
		});
	};

	// Handle update
	const handleUpdate = () => {
		postMessageToExtension({ command: 'updateArianaCli' });
	};

	return (
		<div key={renderKey} className="flex flex-col p-4 max-w-full mx-auto h-full max-h-full">
			<div className="flex flex-col items-center mb-6">
				<img
					src={textLogoUrl}
					alt="Ariana"
					className="h-10 my-6 cursor-pointer"
					onClick={onLogoClick}
				/>
			</div>

			<div className="rounded-md bg-[var(--bg-0)] max-h-full overflow-y-auto scrollbar-w-2">
				<div
					className={"group sticky top-0 z-20 flex items-center justify-between px-4 py-2 bg-[var(--bg-0)] cursor-pointer hover:bg-[var(--bg-2)] transition-colors rounded-sm " + (isCollapsed ? '' : 'border-solid border-b-2 border-[var(--bg-1)] rounded-b-none')}
					onClick={handleToggleCollapse}
				>
					<h2 className="text-md font-medium text-[var(--fg-3)] group-hover:text-[var(--fg-0)]">Getting Started</h2>
					<div className={"h-3 w-3 group-hover:bg-[var(--bg-3)] " + (isCollapsed ? 'rounded-full bg-[var(--bg-1)]' : 'rounded-xs bg-[var(--bg-2)]')}>
					</div>
				</div>

				{!isCollapsed && (
					<div className="px-4 pt-2 pb-6 mt-2">
						<div className="space-y-2">
							<OnboardingStep
								number={1}
								title="Install Ariana CLI"
								active={true}
								completed={cliStatus?.isInstalled}
							>
								{cliStatus?.isInstalled ? (
									<p className="text-[var(--fg-2)]">Ariana CLI is installed. {cliStatus.version && `Version: ${cliStatus.version.split('ariana ')[1]}`}</p>
								) : (
									<>
										<p className="text-[var(--fg-2)]">Install the Ariana CLI to start capturing execution traces.</p>
										
										{cliStatus && (
											<div className="mt-4 space-y-4">
												{cliStatus.npmAvailable && (
													<InstallOption 
														method={ArianaInstallMethod.NPM} 
														command="npm i -g ariana" 
														available={true} 
														onInstall={handleInstall} 
													/>
												)}
												
												{cliStatus.pipAvailable && (
													<InstallOption 
														method={ArianaInstallMethod.PIP} 
														command="pip install ariana" 
														available={true} 
														onInstall={handleInstall} 
													/>
												)}
												
												{!cliStatus.npmAvailable && (
													<InstallOption 
														method={ArianaInstallMethod.NPM} 
														command="npm i -g ariana" 
														available={false} 
														onInstall={handleInstall} 
													/>
												)}
												
												{!cliStatus.pipAvailable && (
													<InstallOption 
														method={ArianaInstallMethod.PIP} 
														command="pip install ariana" 
														available={false} 
														onInstall={handleInstall} 
													/>
												)}
											</div>
										)}
									</>
								)}
							</OnboardingStep>

							<OnboardingStep
								number={2}
								title="Instrument Your Code"
								active={cliStatus?.isInstalled || false}
							>
								<p className="text-[var(--fg-2)]">Add the Ariana decorator to functions you want to trace.</p>
							</OnboardingStep>

							<OnboardingStep
								number={3}
								title="View Traces"
								active={cliStatus?.isInstalled || false}
							>
								<p className="text-[var(--fg-2)]">Hover over your code to see execution traces or view them in this panel.</p>
								<img
									src="https://github.com/dedale-dev/.github/raw/main/ariana_readme_thumbnail.png?raw=true"
									alt="Trace View"
									className="mt-3 rounded-md w-full max-w-md border border-[var(--border-0)]"
								/>
							</OnboardingStep>
						</div>
					</div>
				)}
			</div>
		</div>
	);
};

export default OnboardingTab;
