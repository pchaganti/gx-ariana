import React, { useState, useEffect, ReactNode } from 'react';
import { cn } from '../../lib/utils'; // Assuming cn is in lib/utils relative to components/ui

interface AccordionProps {
  title: ReactNode;
  content: ReactNode;
  uniqueName: string;
  isClosable: boolean;
  startsOpen?: boolean;
  className?: string;
  onToggle?: (isOpen: boolean) => void;
}

const Accordion: React.FC<AccordionProps> = ({
  title,
  content,
  uniqueName,
  isClosable,
  className,
  startsOpen: initialStartsOpen = false, // Default to false if closable, true if not, handled below
  onToggle,
}) => {
  // Adjust startsOpen default based on isClosable
  const actualStartsOpen = isClosable ? initialStartsOpen : true;
  const [isOpen, setIsOpen] = useState(actualStartsOpen);

  useEffect(() => {
    // Sync internal state if startsOpen prop changes externally
    const newActualStartsOpen = isClosable ? initialStartsOpen : true;
    setIsOpen(newActualStartsOpen);
  }, [initialStartsOpen, isClosable]);

  useEffect(() => {
    // Call onToggle callback when isOpen state changes, only if closable
    if (onToggle && isClosable) {
      onToggle(isOpen);
    }
  }, [isOpen, onToggle, isClosable]);

  const handleToggle = () => {
    if (isClosable) {
      setIsOpen(prevOpen => !prevOpen);
    }
  };

  const titleContainerClasses = cn(
    "h-fit flex items-center justify-center w-full gap-2 relative group",
    isClosable ? (isOpen ? "opacity-100" : "opacity-60 mb-2") : "opacity-100"
  );

  return (
    <>
      <div className={titleContainerClasses}>
        <div className="w-10 h-[1px] bg-[var(--border-subtle)]"></div>
        {/* The title prop is rendered here. It inherits text color from parent. */}
        <div>{title}</div> 
        <div className="flex-1 h-[1px] bg-[var(--border-subtle)]"></div>
        {isClosable && (
          <button
            type="button"
            onClick={handleToggle}
            aria-expanded={isOpen}
            aria-controls={`accordion-content-${uniqueName}`}
            className={cn(
              "absolute left-2 p-1 rounded-full transition-opacity",
              "hover:bg-[var(--interactive-active)] hover:text-[var(--bg-base)]",
              "bg-[var(--border-subtle)]"
              // SVG will use currentColor, inheriting from parent text color
            )}
          >
            {isOpen ? (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
              </svg>
            )}
          </button>
        )}
      </div>
      {(isOpen || !isClosable) && (
        <div className={cn(
            className
        )} id={`accordion-content-${uniqueName}`}>
          {content}
        </div>
      )}
    </>
  );
};

export default Accordion;
