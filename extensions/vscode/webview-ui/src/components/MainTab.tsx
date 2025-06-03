import React, { useState, useEffect } from 'react';
import { postMessageToExtension } from '../utils/vscode';
import stateManager from '../utils/stateManager';
import { ArianaCliStatus } from '../lib/cli';
import OnboardingOpenable from './OnboardingOpenable';
import FeedbackButton from './FeedbackButton';
import VaultSelection from './VaultSelection';
import Accordion from './ui/Accordion'; // Import the new Accordion component
import Toggle from './ui/Toggle';
import { useTheme } from '../hooks/useTheme';

interface MainTabProps {
}

const MainTab: React.FC<MainTabProps> = ({ }) => {
	// const { isDark } = useTheme(); // isDark might not be needed directly here anymore
	const [renderKey, setRenderKey] = useState(0);
	const [cliStatus, setCliStatus] = stateManager.usePersistedState<ArianaCliStatus | null>('cliStatus', null);
	const [isWelcomeOpen, setIsWelcomeOpen] = stateManager.usePersistedState<boolean>('isWelcomeOpen', true);
	const [isSettingsOpen, setIsSettingsOpen] = stateManager.usePersistedState<boolean>('isSettingsOpen', true);
	const [highlightingToggled, setHighlightingToggled] = stateManager.usePersistedState<boolean>('highlightingToggle', false);
	const [openPanelAtLaunch, setOpenPanelAtLaunch] = stateManager.usePersistedState<boolean>('openPanelAtLaunch', true);
	const { isDark } = useTheme();

	useEffect(() => {
		postMessageToExtension({ command: 'getArianaCliStatus' });
	}, []);

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

	const handleHighlightingToggle = () => {
		const newValue = !highlightingToggled;
		setHighlightingToggled(newValue);
		postMessageToExtension({ command: 'setHighlightingToggle', value: newValue });
	};

	const handleOpenPanelAtLaunchToggle = () => {
		const newValue = !openPanelAtLaunch;
		setOpenPanelAtLaunch(newValue);
		postMessageToExtension({ command: 'setOpenPanelAtLaunch', value: newValue });
	};

	return (
		<div key={renderKey} className="flex flex-col bg-[var(--surface-default)] min-h-full h-full mx-auto text-[var(--text-default)]">
			<div className="flex flex-col h-full min-h-full">
				<Accordion
					uniqueName="welcome"
					title="Welcome"
					isClosable={true}
					startsOpen={isWelcomeOpen}
					onToggle={setIsWelcomeOpen} // Persist welcome open state
					content={
						<div className="flex flex-col gap-2 p-4 bg-[var(--surface-default)]">
							<FeedbackButton />
							<OnboardingOpenable cliStatus={cliStatus} />
						</div>
					}
				/>
				<Accordion
					uniqueName="runsObserved"
					title="Runs Observed by Ariana"
					isClosable={false}
					startsOpen={true}
					className='flex-1'
					content={<VaultSelection />}
				/>
				<div className="flex flex-col w-full mt-auto">
					<Accordion
						uniqueName="settings"
						title="Settings"
						isClosable={true}
						startsOpen={isSettingsOpen}
						onToggle={setIsSettingsOpen}
						content={
							<div className="flex flex-wrap gap-2 p-4 bg-[var(--surface-default)]">
								<Toggle
									isOn={highlightingToggled}
									onToggle={handleHighlightingToggle}
									isDark={isDark}
									style="success"
									className='flex-1 min-w-fit'
									childrenClassName="!px-3 !py-2"
								>
									<div className="flex justify-between items-center gap-3">
										<span className="text-sm font-medium text-[var(--text-default)]">Traces Highlighting</span>
										<div className={`w-4 h-4 rounded-full ${highlightingToggled ? 'bg-[var(--success-base)] opacity-50 blur-[5px]' : 'bg-[var(--bg-muted)]'}`} />
									</div>
								</Toggle>
								<Toggle
									isDark={isDark}
									style="interactive"
									className='flex-1 min-w-fit'
									childrenClassName="!px-3 !py-2"
									onToggle={handleOpenPanelAtLaunchToggle}
									isOn={openPanelAtLaunch}
								>
									<div className="flex justify-between items-center gap-3">
										<span className="text-sm font-medium text-[var(--text-default)]">Open Panel at Launch</span>
										<div className={`w-4 h-4 rounded-full ${openPanelAtLaunch ? 'bg-[var(--interactive-active)] opacity-70 blur-[5px]' : 'bg-[var(--bg-muted)]'}`} />
									</div>
								</Toggle>
							</div>
						}
					/>
				</div>
			</div>
		</div>
	);
};

export default MainTab;
