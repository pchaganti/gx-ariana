import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, ArrowDown, ArrowUp, Check } from 'lucide-react';

interface SortDropdownProps {
  value: 'asc' | 'desc';
  onChange: (value: 'asc' | 'desc') => void;
}

const options = [
  { value: 'asc', label: <><ArrowUp size={13} className="inline mr-1 -mt-0.5" />Timestamp</> },
  { value: 'desc', label: <><ArrowDown size={13} className="inline mr-1 -mt-0.5" />Timestamp</> },
];

const SortDropdown: React.FC<SortDropdownProps> = ({ value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(o => o.value === value);

  return (
    <div ref={dropdownRef} className="relative text-[var(--text-default)] min-w-[9ch] w-fit">
      <div
        onClick={() => setIsOpen(v => !v)}
        className={`flex items-center justify-between px-2 py-1.5 cursor-pointer rounded-md bg-[var(--surface-code)] min-w-[9ch] w-fit hover:bg-[var(--interactive-hover)] hover:text-[var(--bg-base)] select-none`}
        style={{ minWidth: '9ch', width: 'fit-content' }}
      >
        <span className="text-sm font-semibold flex items-center gap-1">
          {selectedOption?.label}
        </span>
        <ChevronDown size={13} className={`ml-2 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>
      {isOpen && (
        <div className="absolute w-fit backdrop-blur-[3px] rounded-b-md shadow-lg z-30 min-w-[9ch] rounded-lg p-0.5">
          <div className="flex flex-col gap-0.5">
            {options.map(opt => (
              <div key={opt.value}>
                <button
                  onClick={() => { onChange(opt.value as 'asc' | 'desc'); setIsOpen(false); }}
                  className={`px-2 py-1.5 rounded-md min-w-full max-w-[22ch] cursor-pointer text-sm font-semibold flex-shrink-0 flex gap-2 items-center ${opt.value === value ? 'bg-[var(--interactive-hover)] text-[var(--bg-base)]' : 'text-[var(--text-default)]'}`}
                >
                  <span className="flex items-center gap-1">{opt.label}</span>
                  {opt.value === value ? <Check size={13} /> : <Check size={13} className='opacity-0'/>} 
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SortDropdown;
