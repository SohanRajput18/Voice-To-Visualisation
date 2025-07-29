import React, { useEffect, useState } from 'react';
import { History, BarChart3 } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { VoiceInput } from './VoiceInput';
import { DataVisualization } from './DataVisualization';
import { DataTable } from './DataTable';
import { QueryHistorySidebar } from './QueryHistorySidebar';
import { ErrorMessage } from './ErrorMessage';

export function Dashboard() {
  const { state, dispatch } = useApp();
  const { currentQuery } = state;
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    // Initialize theme
    const savedTheme = localStorage.getItem('theme') || 'light';
    if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark');
    }
  }, [dispatch]);

  const handleClearError = () => {
    if (currentQuery) {
      dispatch({
        type: 'SET_CURRENT_QUERY',
        payload: { ...currentQuery, error: undefined },
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-700 transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Query History Toggle Button */}
      <div className="flex justify-end mb-6">
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="flex items-center gap-2 px-6 py-3 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-400 dark:hover:border-gray-500 transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
        >
          <History size={16} />
          <span className="font-medium">Query History</span>
          {state.queryHistory.length > 0 && (
            <span className="ml-1 px-2 py-0.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-xs rounded-full font-medium">
              {state.queryHistory.length}
            </span>
          )}
        </button>
      </div>

      <div className="space-y-6">
          <VoiceInput />
          
          {currentQuery?.error && (
            <ErrorMessage 
              message={currentQuery.error} 
              onClose={handleClearError}
            />
          )}
          
          {currentQuery?.result && (
            <>
              <DataVisualization result={currentQuery.result} />
              <DataTable result={currentQuery.result} />
            </>
          )}
          
          {!currentQuery && (
            <div className="bg-gradient-to-br from-white via-blue-50 to-indigo-50 dark:from-gray-800 dark:via-gray-700 dark:to-gray-600 rounded-xl shadow-lg border border-blue-100 dark:border-gray-600 p-12 text-center transition-all duration-300">
              <div className="text-gray-400 mb-4">
                <div className="mx-auto w-20 h-20 bg-gradient-to-br from-blue-100 to-indigo-200 rounded-full flex items-center justify-center mb-4">
                  <BarChart3 size={32} className="text-blue-600" />
                </div>
              </div>
              <h3 className="text-2xl font-bold text-gray-800 dark:text-white mb-3">
                Welcome to Voice-to-Visualization
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-6 max-w-md mx-auto leading-relaxed">
                Transform your voice or text into beautiful data visualizations. Start by clicking the microphone or switching to text input above.
              </p>
              <div className="flex flex-wrap justify-center gap-4 text-sm text-gray-500">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span>Try: "Show me a pie chart"</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>Or: "Display revenue trends"</span>
                </div>
              </div>
            </div>
          )}

      </div>

      {/* Query History Sidebar */}
      <QueryHistorySidebar 
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
      />
      </div>
    </div>
  );
}