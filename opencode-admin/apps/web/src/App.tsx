import { useEffect, useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { StatusBar } from './components/StatusBar';
import { Dashboard } from './pages/Dashboard';
import { Agents } from './pages/Agents';
import { Plugins } from './pages/Plugins';
import { Providers } from './pages/Providers';
import { ProvidersJson } from './pages/ProvidersJson';
import { MCPServers } from './pages/MCPServers';
import { OAuth } from './pages/OAuth';
import { Secrets } from './pages/Secrets';

import { Apply } from './pages/Apply';
import { Advanced } from './pages/Advanced';
import { getApplyStatus } from './api';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const pageTitles: Record<string, string> = {
  'dashboard': 'Dashboard',
  'agents': 'Agents',
  'council': 'Agents',
  'plugins': 'Plugins',
  'providers': 'Providers & Models',
  'providers-json': 'Providers JSON',
  'mcp-servers': 'MCP Servers',
  'oauth': 'OAuth',
  'secrets': 'Secrets',
  'apply': 'Apply Changes',
  'advanced': 'Advanced JSON',
};

export default function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [lastApplied, setLastApplied] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  const navigateTo = (page: string) => {
    setCurrentPage(page);
    setIsSidebarOpen(false);
  };

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches || ((window.navigator as Navigator & { standalone?: boolean }).standalone === true);
    setIsInstalled(standalone);

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setInstallPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallApp = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      setIsInstalled(true);
    }
    setInstallPrompt(null);
  };

  useEffect(() => {
    async function refreshStatus() {
      try {
        const response = await getApplyStatus();
        setHasUnsavedChanges(response.data.dirty);
        setLastApplied(response.data.lastApplied);
      } catch {
        // keep shell usable even when API is not yet ready
      }
    }
    const onVisible = () => { void refreshStatus(); };
    const interval = window.setInterval(() => { void refreshStatus(); }, 10000);
    window.addEventListener('focus', onVisible);
    document.addEventListener('visibilitychange', onVisible);
    void refreshStatus();
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', onVisible);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />;
      case 'council':
      case 'agents':
        return <Agents />;
      case 'plugins':
        return <Plugins />;
      case 'providers':
        return <Providers />;
      case 'providers-json':
        return <ProvidersJson />;
      case 'mcp-servers':
        return <MCPServers />;
      case 'oauth':
        return <OAuth />;
      case 'secrets':
        return <Secrets />;
      case 'apply':
        return <Apply />;
      case 'advanced':
        return <Advanced />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="app-layout">
      <Sidebar currentPage={currentPage} isOpen={isSidebarOpen} onNavigate={navigateTo} />
      {isSidebarOpen && <button type="button" className="sidebar-overlay" aria-label="Close menu" onClick={() => setIsSidebarOpen(false)} />}
      <div className="main-content">
        <Topbar
          title={pageTitles[currentPage] || 'Dashboard'}
          hasUnsavedChanges={hasUnsavedChanges}
          canInstall={!isInstalled && Boolean(installPrompt)}
          onInstallApp={() => void handleInstallApp()}
          onApply={() => navigateTo('apply')}
          onToggleSidebar={() => setIsSidebarOpen((current) => !current)}
          applying={false}
        />
        <StatusBar hasUnsavedChanges={hasUnsavedChanges} lastApplied={lastApplied} />
        <main className="page-content">
          {renderPage()}
        </main>
      </div>
    </div>
  );
}
