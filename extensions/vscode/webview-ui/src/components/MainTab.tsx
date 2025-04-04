import React, { useState, useEffect } from 'react';
import { cn } from '../lib/utils';

interface OnboardingStepProps {
	number: number;
	title: string;
	description?: string;
	active: boolean;
	children?: React.ReactNode;
}

const OnboardingStep: React.FC<OnboardingStepProps> = ({
	number,
	title,
	description,
	active,
	children
}) => {
	return (
		<div className={cn(
			"flex relative not-last:pb-12",
			active ? "opacity-100" : "opacity-60"
		)}>
			<div className="flex-shrink-0 w-10 h-10 rounded-full bg-[var(--accent)] text-[var(--fg-3)] flex items-center justify-center font-bold text-lg relative z-10">
				{number}
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
				<div className="absolute left-5 top-10 h-full w-0.5 bg-[var(--accent)] text-[var(--fg-3)]" />
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

	// Check if user has seen the onboarding before
	useEffect(() => {
		const hasSeenOnboarding = localStorage.getItem('ariana-has-seen-onboarding');
		if (hasSeenOnboarding === 'true') {
			setIsCollapsed(true);
		}
	}, []);

	// Force rerender when theme changes
	useEffect(() => {
		const handleThemeChange = () => {
			setRenderKey(prev => prev + 1);
		};

		window.addEventListener('message', (event) => {
			const message = event.data;
			if (message.type === 'themeChange') {
				handleThemeChange();
			}
		});

		return () => {
			window.removeEventListener('message', handleThemeChange);
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
							>
								<p className="text-[var(--fg-2)]">Install the Ariana CLI to start capturing execution traces.</p>
								<img
									src="https://github.com/dedale-dev/.github/raw/main/ariana_readme_thumbnail.png?raw=true"
									alt="CLI Installation"
									className="mt-3 rounded-md w-full max-w-md border border-[var(--border-0)]"
								/>
							</OnboardingStep>

							<OnboardingStep
								number={2}
								title="Instrument Your Code"
								active={true}
							>
								<p className="text-[var(--fg-2)]">Add the Ariana decorator to functions you want to trace.</p>
							</OnboardingStep>

							<OnboardingStep
								number={3}
								title="View Traces"
								active={true}
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
