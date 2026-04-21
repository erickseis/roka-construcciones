import React, { useState, useEffect } from 'react';
import { AnimatePresence } from 'motion/react';
import { Compass } from 'lucide-react';
import { CopilotPanel } from './CopilotPanel';

const SESSION_KEY = 'roka_copilot_seen';

export function CopilotButton() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const alreadySeen = sessionStorage.getItem(SESSION_KEY) === 'true';
    if (!alreadySeen) {
      const timer = setTimeout(() => {
        setIsOpen(true);
        sessionStorage.setItem(SESSION_KEY, 'true');
      }, 800);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleToggle = () => {
    setIsOpen(prev => !prev);
  };

  const handleMinimize = () => {
    setIsOpen(false);
  };

  return (
    <>
      <button
        onClick={handleToggle}
        className={`fixed bottom-6 right-24 z-50 flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition-all duration-300 group ${
          isOpen
            ? 'bg-slate-700 hover:bg-slate-800 dark:bg-slate-600 dark:hover:bg-slate-500 shadow-slate-900/20'
            : 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/40 hover:shadow-amber-500/50 hover:scale-105'
        }`}
        title={isOpen ? 'Minimizar guía de flujo' : 'Abrir guía de flujo de trabajo'}
        aria-label={isOpen ? 'Minimizar guía de flujo' : 'Abrir guía de flujo de trabajo'}
      >
        {isOpen ? (
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-white">
            <line x1="4" y1="4" x2="14" y2="14" />
            <line x1="14" y1="4" x2="4" y2="14" />
          </svg>
        ) : (
          <Compass size={22} className="text-white transition-transform duration-300 group-hover:rotate-45" />
        )}
      </button>

      <AnimatePresence>
        {isOpen && <CopilotPanel onClose={handleMinimize} />}
      </AnimatePresence>
    </>
  );
}