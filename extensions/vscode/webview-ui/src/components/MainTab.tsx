import React, { useState, useEffect } from 'react';
import { postMessageToExtension } from '../utils/vscode';
import stateManager from '../utils/stateManager';
import { ArianaCliStatus } from '../lib/cli';
import OnboardingOpenable from './OnboardingOpenable';
import { useTheme } from '../hooks/useTheme';
import FeedbackButton from './FeedbackButton';
import VaultsSelection from './VaultsSelection';
import VaultSelector from './VaultSelector';

interface MainTabProps {
}

const MainTab: React.FC<MainTabProps> = ({  }) => {
	const { isDark } = useTheme();
	const [renderKey, setRenderKey] = useState(0);
	const [cliStatus, setCliStatus] = stateManager.usePersistedState<ArianaCliStatus | null>('cliStatus', null);
	
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

	return (
		<div key={renderKey} className="flex flex-col px-4 pb-4 pt-2 bg-[var(--surface-default)] min-h-full mx-auto text-[var(--text-default)]">
			<div className="flex flex-col gap-2 h-full">
				<FeedbackButton />
				<OnboardingOpenable cliStatus={cliStatus} />
				<VaultSelector />
				<VaultsSelection />
			</div>
		</div>
	);
};

export default MainTab;
