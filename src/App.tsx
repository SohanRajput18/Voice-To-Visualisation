import React from 'react';
import { AppProvider } from './contexts/AppContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Header } from './components/Header';
import { Dashboard } from './components/Dashboard';

function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900 transition-all duration-300">
          <Header />
          <Dashboard />
        </div>
      </AppProvider>
    </ErrorBoundary>
  );
}

export default App;