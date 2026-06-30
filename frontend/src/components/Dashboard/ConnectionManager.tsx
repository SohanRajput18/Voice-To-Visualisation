import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { 
  Database, 
  CheckCircle2, 
  AlertCircle, 
  Trash2, 
  Power, 
  RefreshCw,
  Server,
  FileText,
  Activity
} from 'lucide-react';

interface ConnectionProfile {
  id: number;
  name: string;
  engine: 'postgres' | 'mysql' | 'sqlite';
  is_active: boolean;
  host: string;
  database: string;
  created_at: string;
}

interface ConnectionManagerProps {
  onConnectionChanged: () => void;
  confirmAction: (title: string, message: string, onConfirm: () => void) => void;
}

export const ConnectionManager: React.FC<ConnectionManagerProps> = ({ 
  onConnectionChanged,
  confirmAction
}) => {
  // Connection Form State
  const [name, setName] = useState('');
  const [engine, setEngine] = useState<'postgres' | 'mysql' | 'sqlite'>('postgres');
  const [host, setHost] = useState('localhost');
  const [port, setPort] = useState('5432');
  const [user, setUser] = useState('');
  const [password, setPassword] = useState('');
  const [database, setDatabase] = useState('');
  const [filepath, setFilepath] = useState('');
  const [isActive, setIsActive] = useState(true);

  // Status & Progress States
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Profiles list
  const [profiles, setProfiles] = useState<ConnectionProfile[]>([]);
  const [listLoading, setListLoading] = useState(false);

  useEffect(() => {
    fetchProfiles();
  }, []);

  // Update default port based on engine selection
  useEffect(() => {
    if (engine === 'postgres') {
      setPort('5432');
    } else if (engine === 'mysql') {
      setPort('3306');
    }
  }, [engine]);

  const fetchProfiles = async () => {
    setListLoading(true);
    try {
      const data = await api.listConnections();
      setProfiles(data || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setListLoading(false);
    }
  };

  const getFormConfig = () => {
    if (engine === 'sqlite') {
      return { filepath: filepath.trim() };
    }
    return {
      host: host.trim(),
      port: Number(port),
      user: user.trim(),
      password,
      database: database.trim()
    };
  };

  const handleTestConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    setTesting(true);
    setTestResult(null);

    const config = getFormConfig();
    try {
      const res = await api.testConnection(engine, config);
      if (res.success) {
        setTestResult({ success: true, message: res.message || 'Connection test successful!' });
      } else {
        setTestResult({ success: false, message: res.error || 'Connection failed' });
      }
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || 'Error occurred testing connection' });
    } finally {
      setTesting(false);
    }
  };

  const handleSaveConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setSaveError('Profile name is required');
      return;
    }
    if (engine === 'sqlite' && !filepath.trim()) {
      setSaveError('SQLite DB file path is required');
      return;
    }
    if (engine !== 'sqlite' && (!host.trim() || !user.trim() || !database.trim())) {
      setSaveError('Host, User, and Database Name are required');
      return;
    }

    setSaving(true);
    setSaveError(null);

    const config = getFormConfig();
    try {
      await api.saveConnection(name.trim(), engine, config, isActive);
      // Reset fields
      setName('');
      setUser('');
      setPassword('');
      setDatabase('');
      setFilepath('');
      setTestResult(null);
      
      // Refresh database connections list
      await fetchProfiles();
      onConnectionChanged(); // notify Dashboard to refresh its schema list
    } catch (err: any) {
      setSaveError(err.message || 'Failed to save connection profile');
    } finally {
      setSaving(false);
    }
  };

  const handleActivateProfile = async (id: number) => {
    try {
      await api.activateConnection(id);
      await fetchProfiles();
      onConnectionChanged(); // notify parent component
    } catch (err: any) {
      alert(`Activation failed: ${err.message}`);
    }
  };

  const handleDeleteProfile = (id: number, profileName: string) => {
    confirmAction(
      'Delete Connection Profile',
      `Are you sure you want to delete the database connection profile "${profileName}"?`,
      async () => {
        try {
          await api.deleteConnection(id);
          await fetchProfiles();
          onConnectionChanged();
        } catch (err: any) {
          alert(`Failed to delete profile: ${err.message}`);
        }
      }
    );
  };

  return (
    <div className="connection-manager-container">
      {/* Save Profile Section */}
      <section className="glass-panel" style={{ padding: '1.75rem' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Database size={20} style={{ color: 'var(--accent-cyan)' }} />
          Configure New Database
        </h3>

        <form onSubmit={handleSaveConnection}>
          <div className="input-group">
            <label className="input-label">Connection Profile Name</label>
            <input 
              type="text" 
              className="input-field" 
              placeholder="e.g. Production PostgreSQL, Local SQLite Store" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="input-group">
            <label className="input-label">Database Engine</label>
            <select 
              className="input-field" 
              value={engine}
              onChange={(e) => {
                setEngine(e.target.value as any);
                setTestResult(null);
                setSaveError(null);
              }}
              style={{ background: 'rgba(8, 12, 20, 0.9)', color: 'var(--text-primary)' }}
            >
              <option value="postgres">PostgreSQL</option>
              <option value="mysql">MySQL</option>
              <option value="sqlite">SQLite</option>
            </select>
          </div>

          {engine === 'sqlite' ? (
            <div className="input-group">
              <label className="input-label">SQLite Database File Path (Absolute path recommended)</label>
              <input 
                type="text" 
                className="input-field" 
                placeholder="e.g. C:/data/store.sqlite" 
                value={filepath}
                onChange={(e) => setFilepath(e.target.value)}
                required
              />
            </div>
          ) : (
            <>
              <div className="connection-form-row-host-port">
                <div className="input-group">
                  <label className="input-label">Host Address</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="e.g. localhost or 127.0.0.1" 
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                    required
                  />
                </div>
                <div className="input-group">
                  <label className="input-label">Port</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder={engine === 'postgres' ? '5432' : '3306'} 
                    value={port}
                    onChange={(e) => setPort(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="connection-form-row-auth">
                <div className="input-group">
                  <label className="input-label">Database Username</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="e.g. postgres" 
                    value={user}
                    onChange={(e) => setUser(e.target.value)}
                    required
                  />
                </div>
                <div className="input-group">
                  <label className="input-label">Database Password</label>
                  <input 
                    type="password" 
                    className="input-field" 
                    placeholder="••••••••" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>

              <div className="input-group">
                <label className="input-label">Database Name</label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="e.g. store_analytics" 
                  value={database}
                  onChange={(e) => setDatabase(e.target.value)}
                  required
                />
              </div>
            </>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '1.25rem 0' }}>
            <input 
              id="active-toggle"
              type="checkbox" 
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              style={{ cursor: 'pointer', width: '16px', height: '16px' }}
            />
            <label htmlFor="active-toggle" style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none' }}>
              Set as active database immediately upon save
            </label>
          </div>

          {testResult && (
            <div style={{
              background: testResult.success ? 'rgba(16, 185, 129, 0.1)' : 'rgba(244, 63, 94, 0.1)',
              border: `1px solid ${testResult.success ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)'}`,
              borderRadius: 'var(--radius-md)',
              padding: '0.85rem 1rem',
              marginBottom: '1rem',
              color: testResult.success ? 'var(--accent-emerald)' : 'var(--accent-rose)',
              fontSize: '0.9rem',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.5rem'
            }}>
              {testResult.success ? <CheckCircle2 size={16} style={{ marginTop: '2px' }} /> : <AlertCircle size={16} style={{ marginTop: '2px' }} />}
              <div>{testResult.message}</div>
            </div>
          )}

          {saveError && (
            <div style={{
              background: 'rgba(244, 63, 94, 0.1)',
              border: '1px solid rgba(244, 63, 94, 0.3)',
              borderRadius: 'var(--radius-md)',
              padding: '0.85rem 1rem',
              marginBottom: '1rem',
              color: 'var(--accent-rose)',
              fontSize: '0.9rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <AlertCircle size={16} />
              <div>{saveError}</div>
            </div>
          )}

          <div className="connection-form-buttons">
            <button 
              type="button" 
              className="btn-secondary" 
              onClick={handleTestConnection}
              disabled={testing || saving}
            >
              {testing ? (
                <>
                  <RefreshCw size={16} className="spin" /> Testing...
                </>
              ) : (
                'Test Connection'
              )}
            </button>
            <button 
              type="submit" 
              className="btn-primary" 
              disabled={testing || saving}
            >
              {saving ? (
                <>
                  <span className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }}></span> Saving...
                </>
              ) : (
                'Save Connection'
              )}
            </button>
          </div>
        </form>
      </section>

      {/* Profiles List Section */}
      <section className="glass-panel" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Server size={20} style={{ color: 'var(--accent-violet)' }} />
            Saved Profiles
          </h3>
          <button 
            onClick={fetchProfiles} 
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            title="Refresh list"
          >
            <RefreshCw size={16} className={listLoading ? 'spin' : ''} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', maxHeight: '490px' }}>
          {listLoading && profiles.length === 0 ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
              <span className="spinner"></span>
            </div>
          ) : profiles.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '200px', color: 'var(--text-muted)' }}>
              <Database size={40} style={{ opacity: 0.3, marginBottom: '1rem' }} />
              <p>No database connections saved yet.</p>
              <p style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>Add a connection profile using the configuration form.</p>
            </div>
          ) : (
            <div className="table-wrapper" style={{ border: 'none' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Profile / Database</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {profiles.map((profile) => (
                    <tr key={profile.id} style={{ background: profile.is_active ? 'rgba(6, 182, 212, 0.03)' : 'transparent' }}>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{profile.name}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.15rem' }}>
                          {profile.engine === 'sqlite' ? <FileText size={12} /> : <Server size={12} />}
                          <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '180px' }}>
                            {profile.engine === 'sqlite' ? profile.host : `${profile.host}/${profile.database}`}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className="badge" style={{ 
                          background: profile.engine === 'sqlite' ? 'rgba(139, 92, 246, 0.15)' : profile.engine === 'mysql' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(6, 182, 212, 0.15)',
                          color: profile.engine === 'sqlite' ? 'var(--accent-violet)' : profile.engine === 'mysql' ? 'var(--accent-blue)' : 'var(--accent-cyan)'
                        }}>
                          {profile.engine}
                        </span>
                      </td>
                      <td>
                        {profile.is_active ? (
                          <span className="badge success" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', boxShadow: '0 0 8px rgba(16, 185, 129, 0.15)' }}>
                            <Activity size={10} /> Active
                          </span>
                        ) : (
                          <span className="badge" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)' }}>
                            Inactive
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.5rem', alignItems: 'center' }}>
                          {!profile.is_active && (
                            <button 
                              className="btn-secondary" 
                              style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', borderRadius: '4px', display: 'flex', gap: '0.25rem' }}
                              onClick={() => handleActivateProfile(profile.id)}
                            >
                              <Power size={12} /> Activate
                            </button>
                          )}
                          <button 
                            className="btn-secondary" 
                            style={{ 
                              padding: '0.3rem', 
                              borderRadius: '4px', 
                              color: 'var(--accent-rose)', 
                              borderColor: 'rgba(244, 63, 94, 0.2)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                            title="Delete connection profile"
                            onClick={() => handleDeleteProfile(profile.id, profile.name)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
