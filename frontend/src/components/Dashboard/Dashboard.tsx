import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSpeechToText } from '../../hooks/useSpeechToText';
import { api } from '../../services/api';
import { ChartRenderer } from './ChartRenderer';
import { 
  Mic, 
  MicOff, 
  Play, 
  LogOut, 
  History, 
  Database, 
  AlertCircle, 
  CheckCircle2, 
  Terminal,
  RefreshCw,
  BarChart2,
  LineChart,
  PieChart,
  Table as TableIcon,
  MoreVertical,
  Trash2
} from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const { 
    isListening, 
    transcript, 
    startListening, 
    stopListening, 
    isSupported 
  } = useSpeechToText();

  // Core State
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [sql, setSql] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [columns, setColumns] = useState<any[]>([]);
  const [recommendedChart, setRecommendedChart] = useState<'bar' | 'line' | 'pie' | 'table'>('table');
  const [overrideChart, setOverrideChart] = useState<'bar' | 'line' | 'pie' | 'table' | null>(null);
  
  // Status tracking
  const [queryStatus, setQueryStatus] = useState<'idle' | 'success' | 'invalid' | 'failed'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Meta Lists
  const [history, setHistory] = useState<any[]>([]);
  const [schema, setSchema] = useState<any[]>([]);
  const [schemaLoading, setSchemaLoading] = useState(false);

  // Custom Confirmation & Menu Action States
  const [activeMenuId, setActiveMenuId] = useState<number | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: (() => void) | null;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null
  });

  // Suggested Prompts
  const suggestions = [
    "Show total sales by product category",
    "List top 5 customers by purchase total",
    "Daily sales revenue over time",
    "Show products with lowest stock",
    "Find total transactions count"
  ];

  // Voice transcript listener
  useEffect(() => {
    if (transcript) {
      setPrompt(transcript);
    }
  }, [transcript]);

  // Load history & schema once logged in
  useEffect(() => {
    fetchHistory();
    fetchSchema();
  }, []);

  // Document click listener to close history 3-dots dropdown menu
  useEffect(() => {
    const handleOutsideClick = () => setActiveMenuId(null);
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  const closeConfirmModal = () => {
    setConfirmModal({
      isOpen: false,
      title: '',
      message: '',
      onConfirm: null
    });
  };

  const handleClearHistory = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Clear Analytics History',
      message: 'Are you sure you want to permanently clear all query history? This action cannot be undone.',
      onConfirm: async () => {
        try {
          await api.clearHistory();
          setHistory([]); // locally clear history
        } catch (err: any) {
          console.error(err);
        }
        closeConfirmModal();
      }
    });
  };

  const handleDeleteHistoryItem = (id: number) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete History Entry',
      message: 'Are you sure you want to remove this query log from your history?',
      onConfirm: async () => {
        try {
          await api.deleteHistoryItem(id);
          fetchHistory();
        } catch (err: any) {
          console.error(err);
        }
        closeConfirmModal();
      }
    });
  };

  const fetchHistory = async () => {
    try {
      const log = await api.getHistory();
      setHistory(log);
    } catch (err) {
      console.error('History fetch error:', err);
    }
  };

  const fetchSchema = async () => {
    setSchemaLoading(true);
    try {
      const dbSchema = await api.getSchema();
      setSchema(dbSchema);
    } catch (err) {
      console.error('Schema fetch error:', err);
    } finally {
      setSchemaLoading(false);
    }
  };

  const handleRunQuery = async (queryText: string) => {
    if (!queryText.trim()) return;
    setLoading(true);
    setErrorMessage(null);
    setOverrideChart(null);

    try {
      const data = await api.processQuery(queryText);
      setSql(data.sql || '');
      setQueryStatus(data.status);

      if (data.hasError || data.status === 'invalid' || data.status === 'failed') {
        setErrorMessage(data.error || 'Validation failed');
        setResults([]);
        setColumns([]);
        setRecommendedChart('table');
      } else {
        setResults(data.rows || []);
        setColumns(data.columns || []);
        setRecommendedChart(data.chartType || 'table');
      }
    } catch (err: any) {
      setQueryStatus('failed');
      setErrorMessage(err.message || 'Server error occurred');
      setResults([]);
      setColumns([]);
      setRecommendedChart('table');
    } finally {
      setLoading(false);
      fetchHistory();
    }
  };

  const handleSelectHistory = async (item: any) => {
    setPrompt(item.prompt);
    setSql(item.generated_sql || '');
    setQueryStatus(item.status);
    setOverrideChart(null);
    
    if (item.status === 'success') {
      setErrorMessage(null);
      setRecommendedChart(item.chart_type || 'table');
      // Re-run successful items to load data immediately
      setLoading(true);
      try {
        const validation = await api.processQuery(item.prompt);
        if (!validation.hasError && validation.status === 'success') {
          setResults(validation.rows || []);
          setColumns(validation.columns || []);
        }
      } catch (_) {
        setResults([]);
      } finally {
        setLoading(false);
      }
    } else {
      setErrorMessage(item.error_message || 'Safety validation failure');
      setResults([]);
      setColumns([]);
      setRecommendedChart('table');
    }
  };

  const toggleVoice = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const activeChart = overrideChart || recommendedChart;

  return (
    <div className="app-layout">
      {/* Header Bar */}
      <header className="app-header">
        <div className="logo-section">
          <Terminal size={24} style={{ color: 'var(--accent-cyan)' }} />
          <h2>VoxQuery</h2>
        </div>
        <div className="user-profile">
          <span style={{ fontSize: '0.95rem', color: 'var(--text-secondary)' }}>
            Welcome, <strong>{user?.username}</strong>
          </span>
          <button className="btn-secondary" onClick={logout} style={{ padding: '0.4rem 0.8rem', fontSize: '0.875rem' }}>
            <LogOut size={16} /> Logout
          </button>
        </div>
      </header>

      {/* Main Grid Workspace */}
      <main className="dashboard-grid">
        
        {/* Sidebar Controls */}
        <section className="sidebar-panel glass-panel">
          
          {/* Voice Prompt Block */}
          <div className="glass-card voice-console">
            <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>Voice Prompt Console</h3>
            <button 
              className={`mic-button ${isListening ? 'recording' : ''}`} 
              onClick={toggleVoice}
              title={isListening ? 'Stop listening' : 'Start speaking'}
            >
              {isListening ? <Mic size={32} /> : <MicOff size={32} />}
            </button>
            <p style={{ fontSize: '0.8rem', color: isListening ? 'var(--accent-rose)' : 'var(--text-muted)', marginBottom: '1rem' }}>
              {isListening ? 'Listening... Speak now.' : isSupported ? 'Click Mic to dictate query' : 'Speech recognition not supported in browser'}
            </p>

            <div className="input-group" style={{ width: '100%' }}>
              <textarea
                className="input-field"
                style={{ resize: 'none', height: '90px', fontSize: '0.95rem' }}
                placeholder="Or type your query here..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />
            </div>

            <button 
              className="btn-primary" 
              onClick={() => handleRunQuery(prompt)} 
              disabled={loading || !prompt.trim()}
            >
              {loading ? (
                <span className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }}></span>
              ) : (
                <>
                  <Play size={16} /> Run Analysis
                </>
              )}
            </button>
          </div>

          {/* Database Schema Explorer */}
          <div className="glass-card" style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Database size={18} style={{ color: 'var(--accent-violet)' }} /> Schema Explorer
              </h3>
              <button 
                onClick={fetchSchema} 
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                title="Refresh Schema"
              >
                <RefreshCw size={14} className={schemaLoading ? 'spin' : ''} />
              </button>
            </div>
            
            <div className="schema-viewer" style={{ maxHeight: '350px', overflowY: 'auto', paddingRight: '0.25rem' }}>
              {schema.map((tbl: any) => (
                <div key={tbl.tableName} style={{ marginBottom: '1rem' }}>
                  <div className="schema-table-title">
                    <code>{tbl.tableName}</code>
                  </div>
                  <div className="schema-cols">
                    {tbl.columns.map((col: any) => (
                      <React.Fragment key={col.columnName}>
                        <div>{col.columnName}</div>
                        <div className="schema-col-type">{col.dataType}</div>
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Main Panel Content */}
        <section className="main-content">
          
          {/* Quick suggestions shortcuts */}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            {suggestions.map((sug, idx) => (
              <button
                key={idx}
                className="btn-secondary"
                style={{ fontSize: '0.825rem', padding: '0.4rem 0.8rem', borderRadius: '20px' }}
                onClick={() => {
                  setPrompt(sug);
                  handleRunQuery(sug);
                }}
              >
                {sug}
              </button>
            ))}
          </div>

          {/* Core Visualizer Board */}
          <div className="glass-panel chart-panel">
            <div className="panel-header">
              <div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Analytics Visualization</h2>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                  {queryStatus === 'success' ? 'Showing query execution visualization' : 'Submit a prompt query to generate chart'}
                </p>
              </div>

              {/* Chart Selection Buttons */}
              {results.length > 0 && (
                <div style={{ display: 'flex', gap: '0.5rem', background: 'rgba(0,0,0,0.2)', padding: '0.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-glass)' }}>
                  <button 
                    className={`btn-secondary ${activeChart === 'bar' ? 'active' : ''}`}
                    style={{ padding: '0.35rem 0.6rem', border: 'none', background: activeChart === 'bar' ? 'var(--accent-gradient)' : 'transparent', color: activeChart === 'bar' ? 'white' : 'var(--text-secondary)', borderRadius: '6px' }}
                    onClick={() => setOverrideChart('bar')}
                  >
                    <BarChart2 size={16} />
                  </button>
                  <button 
                    className={`btn-secondary ${activeChart === 'line' ? 'active' : ''}`}
                    style={{ padding: '0.35rem 0.6rem', border: 'none', background: activeChart === 'line' ? 'var(--accent-gradient)' : 'transparent', color: activeChart === 'line' ? 'white' : 'var(--text-secondary)', borderRadius: '6px' }}
                    onClick={() => setOverrideChart('line')}
                  >
                    <LineChart size={16} />
                  </button>
                  <button 
                    className={`btn-secondary ${activeChart === 'pie' ? 'active' : ''}`}
                    style={{ padding: '0.35rem 0.6rem', border: 'none', background: activeChart === 'pie' ? 'var(--accent-gradient)' : 'transparent', color: activeChart === 'pie' ? 'white' : 'var(--text-secondary)', borderRadius: '6px' }}
                    onClick={() => setOverrideChart('pie')}
                  >
                    <PieChart size={16} />
                  </button>
                  <button 
                    className={`btn-secondary ${activeChart === 'table' ? 'active' : ''}`}
                    style={{ padding: '0.35rem 0.6rem', border: 'none', background: activeChart === 'table' ? 'var(--accent-gradient)' : 'transparent', color: activeChart === 'table' ? 'white' : 'var(--text-secondary)', borderRadius: '6px' }}
                    onClick={() => setOverrideChart('table')}
                  >
                    <TableIcon size={16} />
                  </button>
                </div>
              )}
            </div>

            <div className="chart-container">
              {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                  <span className="spinner"></span>
                  <p style={{ color: 'var(--text-secondary)' }}>Generating visualization...</p>
                </div>
              ) : results.length > 0 ? (
                <ChartRenderer data={results} columns={columns} chartType={activeChart} />
              ) : (
                <div style={{ color: 'var(--text-muted)', fontSize: '1rem' }}>
                  No active dataset. Dictate or input a question to run analytics.
                </div>
              )}
            </div>
          </div>

          {/* SQL Code & Validation Preview Board */}
          {sql && (
            <div className="glass-panel" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Terminal size={18} style={{ color: 'var(--accent-cyan)' }} /> Execution Sandbox
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {queryStatus === 'success' ? (
                    <span className="badge success" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <CheckCircle2 size={12} /> SQL Approved
                    </span>
                  ) : (
                    <span className="badge failed" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <AlertCircle size={12} /> Blocked/Failed
                    </span>
                  )}
                </div>
              </div>

              {errorMessage && (
                <div style={{
                  background: 'rgba(244, 63, 94, 0.12)',
                  border: '1px solid rgba(244, 63, 94, 0.3)',
                  color: '#f43f5e',
                  borderRadius: 'var(--radius-md)',
                  padding: '1rem',
                  marginBottom: '1rem',
                  fontSize: '0.9rem'
                }}>
                  <strong>Safety/Validation Error:</strong> {errorMessage}
                </div>
              )}

              <div className="sql-preview">
                <span className="sql-badge">Generated SQL</span>
                <pre><code>{sql}</code></pre>
              </div>
            </div>
          )}

          {/* History Tracker */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <History size={18} style={{ color: 'var(--text-secondary)' }} /> Analytics History Log
              </h3>
              {history.length > 0 && (
                <button 
                  className="btn-secondary" 
                  style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', color: 'var(--accent-rose)', borderColor: 'rgba(244, 63, 94, 0.3)' }}
                  onClick={handleClearHistory}
                >
                  Clear History
                </button>
              )}
            </div>
            
            <div className="history-list">
              {history.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No history records yet.</p>
              ) : (
                history.map((item) => (
                  <div 
                    key={item.id} 
                    className="glass-card history-item"
                  >
                    <div 
                      className="history-item-content" 
                      onClick={() => handleSelectHistory(item)}
                    >
                      <div className="history-item-header">
                        <strong style={{ color: 'var(--text-primary)' }}>"{item.prompt}"</strong>
                        <span className={`badge ${item.status}`}>
                          {item.status}
                        </span>
                      </div>
                      <code style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)', display: 'block', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {item.generated_sql || '-- SQL Generation failed'}
                      </code>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        {new Date(item.created_at).toLocaleString()}
                      </span>
                    </div>

                    <div className="history-item-actions">
                      <button 
                        className="history-menu-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuId(activeMenuId === item.id ? null : item.id);
                        }}
                      >
                        <MoreVertical size={16} />
                      </button>
                      
                      {activeMenuId === item.id && (
                        <div className="history-menu-dropdown">
                          <button 
                            className="history-menu-item"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenuId(null);
                              handleDeleteHistoryItem(item.id);
                            }}
                          >
                            <Trash2 size={12} /> Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </section>
      </main>

      {/* Custom Confirmation Modal */}
      {confirmModal.isOpen && (
        <div className="confirm-modal-overlay">
          <div className="confirm-modal-box glass-panel" style={{ background: '#0f172a', border: '1px solid var(--border-glass-active)' }}>
            <h3 style={{ marginBottom: '0.5rem' }}>{confirmModal.title}</h3>
            <p style={{ marginBottom: '1.5rem' }}>{confirmModal.message}</p>
            <div className="confirm-modal-actions">
              <button className="btn-secondary" onClick={closeConfirmModal} style={{ padding: '0.5rem 1.25rem', fontSize: '0.9rem' }}>
                Cancel
              </button>
              <button 
                className="btn-primary" 
                onClick={confirmModal.onConfirm || (() => {})} 
                style={{ padding: '0.5rem 1.25rem', background: 'var(--accent-rose)', border: 'none', fontSize: '0.9rem' }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
