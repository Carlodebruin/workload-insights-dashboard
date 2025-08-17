import React, { useState, useEffect, useRef } from 'react';
import { Sun, Moon, Laptop } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';

const ThemeToggle: React.FC = () => {
  const { setTheme, theme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const toggleDropdown = () => setIsOpen(!isOpen);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={toggleDropdown}
        className="flex items-center justify-center h-9 w-9 rounded-full bg-transparent text-muted-foreground hover:bg-secondary hover:text-secondary-foreground transition-colors"
        aria-label="Toggle theme"
      >
        <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
        <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      </button>
      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-36 bg-popover border border-border rounded-md shadow-lg z-20 py-1"
          role="menu"
          aria-orientation="vertical"
        >
          <button
            onClick={() => { setTheme('light'); setIsOpen(false); }}
            className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-accent ${theme === 'light' ? 'text-primary' : 'text-popover-foreground'}`}
            role="menuitem"
          >
            <Sun size={14} /> Light
          </button>
          <button
            onClick={() => { setTheme('dark'); setIsOpen(false); }}
            className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-accent ${theme === 'dark' ? 'text-primary' : 'text-popover-foreground'}`}
            role="menuitem"
          >
            <Moon size={14} /> Dark
          </button>
          <button
            onClick={() => { setTheme('system'); setIsOpen(false); }}
            className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-accent ${theme === 'system' ? 'text-primary' : 'text-popover-foreground'}`}
            role="menuitem"
          >
            <Laptop size={14} /> System
          </button>
        </div>
      )}
    </div>
  );
};

export default ThemeToggle;
