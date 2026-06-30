import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend
} from 'recharts';
import {
  Activity,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RefreshCw,
  Terminal,
  ShieldAlert,
  Calendar,
  Layers,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface AuditLog {
  id: number;
  prompt: string;
  generated_sql: string;
  status: 'success' | 'failed' | 'invalid';
  execution_time_ms: number;
  chart_type: string;
  confidence: number | string;
  created_at: string;
}

interface AnalyticsData {
  summary: {
    totalQueries: number;
    successCount: number;
    invalidCount: number;
    failedCount: number;
    avgLatencyMs: number;
  };
  chartDistribution: Array<{ chart_type: string; count: string | number }>;
  logs: AuditLog[];
}

export const AnalyticsMonitor: React.FC = () => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedLogId, setExpandedLogId] = useState<number | null>(null);

  // Filter state for audit logs
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'failed' | 'invalid'>('all');

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const stats = await api.getAnalytics();
      setData(stats);
    } catch (err: any) {
      setError(err.message || 'Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '400px', gap: '1rem' }}>
        <span className="spinner"></span>
        <p style={{ color: 'var(--text-secondary)' }}>Loading analytics dashboard...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', color: 'var(--accent-rose)' }}>
        <AlertTriangle size={36} style={{ marginBottom: '1rem' }} />
        <h3>Error Loading Analytics</h3>
        <p style={{ color: 'var(--text-secondary)', margin: '0.5rem 0 1.5rem' }}>{error || 'No data returned'}</p>
        <button className="btn-secondary" onClick={fetchAnalytics} style={{ margin: '0 auto' }}>
          <RefreshCw size={14} /> Retry
        </button>
      </div>
    );
  }

  const { summary, chartDistribution, logs } = data;

  // Calculate Success Rate
  const successRate = summary.totalQueries > 0 
    ? Math.round((summary.successCount / summary.totalQueries) * 100) 
    : 0;

  // Chart data formatting
  const statusChartData = [
    { name: 'Success', value: summary.successCount, color: '#10b981' },
    { name: 'Invalid', value: summary.invalidCount, color: '#eab308' },
    { name: 'Failed', value: summary.failedCount, color: '#f43f5e' }
  ].filter(d => d.value > 0);

  const formattedChartDistribution = chartDistribution.map(item => ({
    name: item.chart_type.charAt(0).toUpperCase() + item.chart_type.slice(1),
    count: Number(item.count)
  }));

  const filteredLogs = logs.filter(log => {
    if (statusFilter === 'all') return true;
    return log.status === statusFilter;
  });

  const toggleExpandLog = (id: number) => {
    setExpandedLogId(expandedLogId === id ? null : id);
  };

  const STATUS_COLORS = {
    success: '#10b981',
    invalid: '#eab308',
    failed: '#f43f5e'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
      {/* Header action */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Analytics & Audit Dashboard</h2>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            Real-time query performance metrics and security audit tracking
          </p>
        </div>
        <button className="btn-secondary" onClick={fetchAnalytics} style={{ padding: '0.4rem 0.8rem' }}>
          <RefreshCw size={14} /> Refresh Metrics
        </button>
      </div>

      {/* KPI Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        {/* Card 1: Total queries */}
        <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ background: 'rgba(6, 182, 212, 0.1)', padding: '0.75rem', borderRadius: 'var(--radius-md)', color: 'var(--accent-cyan)' }}>
            <Activity size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Total Queries</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, marginTop: '0.1rem' }}>{summary.totalQueries}</div>
          </div>
        </div>

        {/* Card 2: Success Rate */}
        <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '0.75rem', borderRadius: 'var(--radius-md)', color: 'var(--accent-emerald)' }}>
            <CheckCircle2 size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Success Rate</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, marginTop: '0.1rem', color: 'var(--accent-emerald)' }}>{successRate}%</div>
          </div>
        </div>

        {/* Card 3: Avg Latency */}
        <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '0.75rem', borderRadius: 'var(--radius-md)', color: 'var(--accent-blue)' }}>
            <Clock size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Average Latency</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, marginTop: '0.1rem' }}>{summary.avgLatencyMs} <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-muted)' }}>ms</span></div>
          </div>
        </div>

        {/* Card 4: Blocks & Safety */}
        <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ background: 'rgba(244, 63, 94, 0.1)', padding: '0.75rem', borderRadius: 'var(--radius-md)', color: 'var(--accent-rose)' }}>
            <ShieldAlert size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Blocked / Failed</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, marginTop: '0.1rem', color: 'var(--accent-rose)' }}>
              {summary.invalidCount + summary.failedCount}
            </div>
          </div>
        </div>
      </div>

      {/* Middle row: Visual Chart Breakdowns */}
      <div className="analytics-charts-container">
        {/* Chart 1: Status Breakdown */}
        <div className="glass-panel analytics-chart-item" style={{ padding: '1.5rem', minHeight: '280px', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Layers size={16} style={{ color: 'var(--accent-cyan)' }} /> Query Safety & Status Breakdown
          </h3>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {statusChartData.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No data to represent query statuses.</div>
            ) : (
              <div style={{ width: '100%', height: '180px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {statusChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid var(--border-glass-active)', borderRadius: '6px', color: 'white' }} />
                    <Legend verticalAlign="bottom" iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        {/* Chart 2: Recommended Chart Distribution */}
        <div className="glass-panel analytics-chart-item" style={{ padding: '1.5rem', minHeight: '280px', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Terminal size={16} style={{ color: 'var(--accent-violet)' }} /> Visualization Recommendations
          </h3>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {formattedChartDistribution.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No visualizations rendered yet.</div>
            ) : (
              <div style={{ width: '100%', height: '180px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={formattedChartDistribution} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                    <XAxis dataKey="name" stroke="var(--text-muted)" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                    <YAxis stroke="var(--text-muted)" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid var(--border-glass-active)', borderRadius: '6px', color: 'white' }} />
                    <Bar dataKey="count" fill="var(--accent-violet)" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Section: Query Audit Logs Table */}
      <section className="glass-panel" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Terminal size={18} style={{ color: 'var(--accent-cyan)' }} />
            Security & Execution Audit Log
          </h3>

          {/* Filter Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Status:</span>
            <select
              className="input-field"
              style={{ width: '120px', padding: '0.25rem 0.5rem', fontSize: '0.8rem', background: '#0f172a' }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
            >
              <option value="all">All Logs</option>
              <option value="success">Success</option>
              <option value="invalid">Invalid</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>

        <div className="table-wrapper" style={{ border: 'none', maxHeight: '450px', overflowY: 'auto' }}>
          {filteredLogs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              No audit logs match the selected filter.
            </div>
          ) : (
            <table className="data-table" style={{ fontSize: '0.875rem' }}>
              <thead>
                <tr>
                  <th style={{ width: '40px' }}></th>
                  <th>NL Prompt</th>
                  <th>Status</th>
                  <th>Latency</th>
                  <th>Confidence</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => {
                  const isExpanded = expandedLogId === log.id;
                  const confidenceVal = typeof log.confidence === 'string' ? Number(log.confidence) : log.confidence;
                  const formattedConfidence = confidenceVal ? `${Math.round(confidenceVal * 100)}%` : '0%';

                  return (
                    <React.Fragment key={log.id}>
                      <tr 
                        onClick={() => toggleExpandLog(log.id)}
                        style={{ cursor: 'pointer', borderBottom: isExpanded ? 'none' : '1px solid var(--border-glass)' }}
                      >
                        <td>
                          {isExpanded ? <ChevronUp size={16} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={16} style={{ color: 'var(--text-muted)' }} />}
                        </td>
                        <td style={{ fontWeight: 500, maxWidth: '280px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          "{log.prompt}"
                        </td>
                        <td>
                          <span className="badge" style={{ 
                            background: log.status === 'success' ? 'rgba(16, 185, 129, 0.15)' : log.status === 'invalid' ? 'rgba(234, 179, 8, 0.15)' : 'rgba(244, 63, 94, 0.15)',
                            color: STATUS_COLORS[log.status]
                          }}>
                            {log.status}
                          </span>
                        </td>
                        <td style={{ color: 'var(--text-secondary)' }}>
                          {log.execution_time_ms} ms
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <div style={{ width: '40px', background: 'rgba(255,255,255,0.05)', height: '6px', borderRadius: '3px', overflow: 'hidden' }}>
                              <div style={{ 
                                width: formattedConfidence, 
                                background: confidenceVal > 0.8 ? 'var(--accent-emerald)' : confidenceVal > 0.5 ? 'var(--accent-cyan)' : 'var(--accent-rose)', 
                                height: '100%' 
                              }} />
                            </div>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', width: '30px' }}>{formattedConfidence}</span>
                          </div>
                        </td>
                        <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <Calendar size={12} />
                            {new Date(log.created_at).toLocaleString()}
                          </span>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr style={{ background: 'rgba(15, 23, 42, 0.25)' }}>
                          <td></td>
                          <td colSpan={5} style={{ padding: '1rem', borderBottom: '1px solid var(--border-glass)' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                              {/* Full prompt */}
                              <div>
                                <strong style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>User Query:</strong>
                                <p style={{ marginTop: '0.25rem', fontSize: '0.9rem', color: 'var(--text-primary)' }}>{log.prompt}</p>
                              </div>

                              {/* SQL Statement */}
                              {log.generated_sql && (
                                <div>
                                  <strong style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Generated SQL Code:</strong>
                                  <div className="sql-preview" style={{ padding: '0.75rem', marginTop: '0.35rem', background: '#050811' }}>
                                    <pre style={{ fontSize: '0.8rem' }}><code>{log.generated_sql}</code></pre>
                                  </div>
                                </div>
                              )}

                              {/* Info block */}
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '0.75rem' }}>
                                <div><strong>Audit Log ID:</strong> #{log.id}</div>
                                <div><strong>Visualization Format:</strong> {log.chart_type}</div>
                                <div><strong>Reasoning Confidence:</strong> {formattedConfidence}</div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
};
