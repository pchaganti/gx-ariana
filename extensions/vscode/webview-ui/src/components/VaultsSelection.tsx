import React from 'react';
import { cn } from '../lib/utils';
import { postMessageToExtension } from '../utils/vscode';
import stateManager from '../utils/stateManager';
import { useTheme } from '../hooks/useTheme';

interface VaultsSelectionProps {
}

const VaultsSelection: React.FC<VaultsSelectionProps> = ({ }) => {
    const { isDark } = useTheme();

    const [isHidden, setIsHidden] = stateManager.usePersistedState('feedbackButtonHidden', false);

    if (isHidden) {return (<></>);}

	return (
    <button                 
        onClick={(e) => {
            e.preventDefault();
            postMessageToExtension({ 
                command: 'openExternal', 
                url: 'https://discord.gg/Y3TFTmE89g' 
            });
        }} 
        className={cn(
        "group w-full p-[0.05rem] transition-all flex flex-col text-left h-fit hover:p-0 cursor-pointer"
    )}>
      <div className={cn(
        "relative rounded-2xl h-full w-full overflow-hidden",
        isDark ? "shadow-[0_5px_5px_3px_var(--bg-600)]" : "shadow-[0_5px_5px_3px_var(--bg-550)]",
        isDark ? "bg-[var(--bg-400)]" : "bg-[var(--bg-550)]",
      )}>
        <button onClick={(e) => {
            e.stopPropagation();
            setIsHidden(!isHidden);
        }} className={cn(
            "group-hover:opacity-100 opacity-0 absolute z-50 cursor-pointer top-1 right-1 rounded-full hover:bg-[var(--bg-600)] text-[var(--text-muted)] p-1 transition-all pointer-events-auto",
        )}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" className="size-5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
        </button>
        <div className={cn(
          "absolute w-full h-full bg-transparent z-30 transition-all",
          isDark ? "inset-shadow-[0_5px_10px_2.5px_var(--bg-200)] hover:inset-shadow-[0_10px_20px_5px_var(--bg-200)]" : "inset-shadow-[0_5px_10px_2.5px_var(--bg-600)] hover:inset-shadow-[0_10px_20px_5px_var(--bg-600)]",
        )}>
        </div>
        <div className={cn(
          "w-full h-full flex flex-col justify-center px-6 py-4 transition-all",
        )}
        >
          <div className={cn(
            "flex flex-col gap-2 transition-all text-[var(--fg-base)]",
          )}>
            <div className='text-base font-bold'>
                ⚠️ Ariana's beta only works with some JS, TS & Python projects
            </div>
            <div className='text-xs'>
                It would help us a lot if you could click here to join the discord server and report any issues you may encounter while using it on your code
            </div>
          </div>
        </div>
      </div>
    </button>
	);
};

export default VaultsSelection;
