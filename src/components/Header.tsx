import React from 'react';
import { BarChart3, Settings, Moon, Sun } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { SettingsModal } from './SettingsModal';

export function Header() {
  const { state, dispatch } = useApp();
  const { theme } = state;
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);

  const toggleTheme = () => {
    dispatch({ type: 'TOGGLE_THEME' });
  };

  return (
    <>
      <header className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 dark:from-gray-800 dark:via-gray-900 dark:to-black shadow-lg transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white bg-opacity-20 rounded-lg">
                <BarChart3 className="text-white" size={24} />
              </div>
              <h1 className="text-xl font-bold text-white">
                Voice-to-Visualization
              </h1>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Theme Toggle Button */}
              <button
                onClick={toggleTheme}
                className="p-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg transition-all duration-200 text-white hover:scale-105"
                title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
              >
                {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
              </button>
              
              {/* Settings Button */}
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="p-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg transition-all duration-200 text-white hover:scale-105"
                title="Open settings"
              >
                <Settings size={20} />
              </button>
            </div>
          </div>
        </div>
      </header>
      
      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
      />
    </>
  );
}