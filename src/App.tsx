import React, { useState } from 'react';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import CRM from './pages/CRM';
import Login from './pages/Login';
import Projects from './pages/Projects';
import Calendar from './pages/Calendar';
import Documents from './pages/Documents';
import Settings from './pages/Settings';
import Finance from './pages/Finance';
import Communications from './pages/Communications';
import { useAuth } from './contexts/AuthContext';
import ContentErrorBoundary from './components/ContentErrorBoundary';
import { setPendingNavigationIntent } from './lib/navigation';

export default function App() {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');

  if (loading) {
    return (
      <div className="min-h-screen bg-os-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-brand border-t-transparent rounded-full animate-spin"></div>
          <p className="text-[10px] font-mono font-bold tracking-[0.3em] text-gray-400 uppercase">Booting OS...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <Dashboard
            onOpenProject={(projectId) => {
              setPendingNavigationIntent({ kind: 'open-project', projectId });
              setActiveTab('projects');
            }}
          />
        );
      case 'crm': return <CRM />;
      case 'projects': return <Projects />;
      case 'calendar':
        return (
          <Calendar
            onOpenProject={(projectId) => {
              setPendingNavigationIntent({ kind: 'open-project', projectId });
              setActiveTab('projects');
            }}
            onOpenFinance={() => {
              setActiveTab('finance');
            }}
            onCreateTransaction={(timestamp) => {
              setPendingNavigationIntent({ kind: 'create-transaction', timestamp });
              setActiveTab('finance');
            }}
          />
        );
      case 'finance': return <Finance />;
      case 'messages': return <Communications />;
      case 'docs': return <Documents />;
      case 'settings': return <Settings />;
      default: return <Dashboard />;
    }
  };

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
      <ContentErrorBoundary resetKey={activeTab}>
        {renderContent()}
      </ContentErrorBoundary>
    </Layout>
  );
}
