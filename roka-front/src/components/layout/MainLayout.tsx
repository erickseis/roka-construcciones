import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '../Sidebar';
import { Header } from '../Header';
import { CopilotButton } from '../copilot/CopilotButton';
import { RokaChatbot } from '../chat/RokaChatbot';

export function MainLayout() {
  return (
    <div className="min-h-screen bg-[#f7fafc] dark:bg-[#0b0e14]">
      <Sidebar />
      <Header />
      <main className="ml-64 p-10 pt-6">
        <div className="mx-auto max-w-7xl">
          <Outlet />
        </div>
      </main>
      <CopilotButton />
      <RokaChatbot />
    </div>
  );
}
