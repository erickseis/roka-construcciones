import React, { useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Sidebar } from '../Sidebar';
import { Header } from '../Header';
import { CopilotButton } from '../copilot/CopilotButton';
import { RokaChatbot } from '../chat/RokaChatbot';
import { UserProfileModal } from '../profile/UserProfileModal';

export function MainLayout() {
  const { user, loading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f7fafc] dark:bg-[#0b0e14]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#05070a]">
      <Sidebar 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
        onProfileClick={() => setProfileOpen(true)}
      />
      
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

      <UserProfileModal isOpen={profileOpen} onClose={() => setProfileOpen(false)} />
    </div>
  );
}
