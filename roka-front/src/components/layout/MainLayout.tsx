import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '../Sidebar';
import { Header } from '../Header';
import { CopilotButton } from '../copilot/CopilotButton';
import { RokaChatbot } from '../chat/RokaChatbot';

export function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#f7fafc] dark:bg-[#0b0e14]">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Header onMenuClick={() => setSidebarOpen(true)} />
      
      <main className="transition-all duration-300 lg:ml-64 p-4 md:p-10 pt-6">
        <div className="mx-auto max-w-7xl">
          <Outlet />
        </div>
      </main>
      
      <CopilotButton />
      <RokaChatbot />
    </div>
  );
}
