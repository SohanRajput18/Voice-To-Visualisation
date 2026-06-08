import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthScreen } from './components/Auth/AuthScreen';
import { Dashboard } from './components/Dashboard/Dashboard';

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        backgroundColor: 'var(--bg-primary)',
        color: 'var(--text-primary)',
        flexDirection: 'column',
        gap: '1.5rem'
      }}>
        <span className="spinner"></span>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Loading VoxQuery Dashboard...</h2>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  return <Dashboard />;
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;
