import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '../Sidebar';
import { Header } from '../Header';

export function MainLayout() {
  return (
    <div className="min-h-screen bg-[#f7fafc] dark:bg-slate-950">
      <Sidebar />
      <Header />
      <main className="ml-64 p-10 pt-6">
        <div className="mx-auto max-w-7xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
