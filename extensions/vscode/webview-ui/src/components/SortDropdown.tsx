import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, ArrowDown, ArrowUp, Check } from 'lucide-react';

interface SortDropdownProps {
  value: 'asc' | 'desc';
  onChange: (value: 'asc' | 'desc') => void;
}

const options = [
  { value: 'asc', label: <><ArrowUp size={16} className="inline mr-1 -mt-0.5" />Timestamp</> },
  { value: 'desc', label: <><ArrowDown size={16} className="inline mr-1 -mt-0.5" />Timestamp</> },
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
    <div ref={dropdownRef} className="relative text-[var(--fg-0)] min-w-[9ch] w-fit">
      <div
        onClick={() => setIsOpen(v => !v)}
        className={`flex items-center justify-between px-2 py-2 cursor-pointer rounded-md bg-[var(--bg-0)] min-w-[9ch] w-fit hover:bg-[var(--accent)] select-none`}
        style={{ minWidth: '9ch', width: 'fit-content' }}
      >
        <span className="text-xs font-semibold flex items-center gap-1">
          {selectedOption?.label}
        </span>
        <ChevronDown size={16} className={`ml-2 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>
      {isOpen && (
        <div className="absolute w-fit bg-[var(--bg-2)] rounded-b-md shadow-lg z-30 min-w-[9ch] p-0.5 pb-1 rounded-md">
          <div className="flex flex-col">
            {options.map(opt => (
              <div key={opt.value}>
                <button
                  onClick={() => { onChange(opt.value as 'asc' | 'desc'); setIsOpen(false); }}
                  className={`text-[var(--fg-0)] px-4 py-2 rounded-md h-[2.5rem] min-w-full max-w-[22ch] cursor-pointer text-xs font-semibold flex-shrink-0 flex gap-2 items-center ${opt.value === value ? 'bg-[var(--accent)]' : 'bg-[var(--bg-0)]'}`}
                >
                  <span className="flex items-center gap-1">{opt.label}</span>
                  {opt.value === value ? <Check size={14} /> : <Check size={14} className='opacity-0'/>} 
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
