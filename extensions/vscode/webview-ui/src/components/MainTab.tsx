import React, { useState, useEffect } from 'react';
import { postMessageToExtension } from '../utils/vscode';
import stateManager from '../utils/stateManager';
import { ArianaCliStatus } from '../lib/cli';
import OnboardingOpenable from './OnboardingOpenable';
import { useTheme } from '../hooks/useTheme';
import FeedbackButton from './FeedbackButton';
import VaultSelection from './VaultSelection';
import VaultSelector from './VaultSelector';
import { cn } from '../lib/utils';

interface MainTabProps {
}

const MainTab: React.FC<MainTabProps> = ({  }) => {
	const { isDark } = useTheme();
	const [renderKey, setRenderKey] = useState(0);
	const [cliStatus, setCliStatus] = stateManager.usePersistedState<ArianaCliStatus | null>('cliStatus', null);
	const [isWelcomeOpen, setIsWelcomeOpen] = stateManager.usePersistedState<boolean>('isWelcomeOpen', true);
	
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

	return (
		<div key={renderKey} className="flex flex-col bg-[var(--surface-default)] min-h-full mx-auto text-[var(--text-default)]">
			<div className="flex flex-col h-full">
				<div className={cn(
					"h-fit flex items-center justify-center w-full gap-2 relative group",
					isWelcomeOpen ? "opacity-100" : "opacity-60 mb-2"
				)}>
					<div className="w-10 h-[1px] bg-[var(--border-subtle)]"></div>
					<div>Welcome</div>
					<div className="flex-1 h-[1px] bg-[var(--border-subtle)]"></div>
					<button
						onClick={() => setIsWelcomeOpen(!isWelcomeOpen)}
						className={cn(
							"absolute left-2 p-1 rounded-full transition-opacity",
							"hover:bg-[var(--interactive-active)]",
							"bg-[var(--border-subtle)]"
						)}
					>
						{isWelcomeOpen ? (
							<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
								<path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
							</svg>
						) : (
							<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
								<path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
							</svg>
						)}
					</button>
				</div>
				{isWelcomeOpen && (
					<div className="flex flex-col gap-2 p-4 bg-[var(--surface-default)]">
						<FeedbackButton />
						<OnboardingOpenable cliStatus={cliStatus} />
					</div>
				)}
				{/* <VaultSelector /> */}
				<div className="h-fit flex items-center justify-center w-full gap-2">
					<div className="w-10 h-[1px] bg-[var(--border-subtle)]"></div>
					<div>Runs Observed by Ariana</div>
					<div className="flex-1 h-[1px] bg-[var(--border-subtle)]"></div>
				</div>
				<VaultSelection />
			</div>
		</div>
	);
};

export default MainTab;
