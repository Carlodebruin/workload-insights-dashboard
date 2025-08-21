
import React from 'react';
import { BarChart3, Sparkles, Shield, Map, MessageSquare } from 'lucide-react';
import ThemeToggle from './ThemeToggle';

interface HeaderProps {
    view: 'dashboard' | 'ai-insights' | 'admin' | 'map' | 'whatsapp-messages';
    setView: (view: 'dashboard' | 'ai-insights' | 'admin' | 'map' | 'whatsapp-messages') => void;
}

const Header: React.FC<HeaderProps> = ({ view, setView }) => {
  const navButtonClasses = "flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors";
  const activeClasses = "bg-primary text-primary-foreground";
  const inactiveClasses = "text-muted-foreground hover:bg-secondary hover:text-secondary-foreground";

  return (
    <header className="border-b border-border px-4 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between h-16">
        <div className="flex items-center space-x-3">
            <BarChart3 className="h-8 w-8 text-primary" />
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
                Workload Insights
            </h1>
        </div>
        <div className="flex items-center space-x-1 sm:space-x-2">
            <nav className="flex items-center space-x-1 sm:space-x-2">
                <button 
                    onClick={() => setView('dashboard')}
                    className={`${navButtonClasses} ${view === 'dashboard' ? activeClasses : inactiveClasses}`}
                >
                    <span>Dashboard</span>
                </button>
                <button 
                    onClick={() => setView('map')}
                    className={`${navButtonClasses} ${view === 'map' ? activeClasses : inactiveClasses}`}
                >
                    <Map className="h-4 w-4" />
                    <span>Map</span>
                </button>
                <button 
                    onClick={() => setView('whatsapp-messages')}
                    className={`${navButtonClasses} ${view === 'whatsapp-messages' ? activeClasses : inactiveClasses}`}
                >
                    <MessageSquare className="h-4 w-4" />
                    <span>WhatsApp</span>
                </button>
                <button 
                    onClick={() => setView('ai-insights')}
                    className={`${navButtonClasses} ${view === 'ai-insights' ? activeClasses : inactiveClasses}`}
                >
                    <Sparkles className="h-4 w-4" />
                    <span>AI Chat</span>
                </button>
                <button 
                    onClick={() => setView('admin')}
                    className={`${navButtonClasses} ${view === 'admin' ? activeClasses : inactiveClasses}`}
                >
                    <Shield className="h-4 w-4" />
                    <span>Admin</span>
                </button>
            </nav>
            <div className="pl-2">
                 <ThemeToggle />
            </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
