import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';

interface ChartRendererProps {
  data: any[];
  columns: Array<{ name: string; dataType: any }>;
  chartType: 'bar' | 'line' | 'pie' | 'table';
}

const COLORS = ['#06b6d4', '#8b5cf6', '#3b82f6', '#10b981', '#f43f5e', '#eab308'];

export const ChartRenderer: React.FC<ChartRendererProps> = ({ data, columns, chartType }) => {
  if (!data || data.length === 0) {
    return (
      <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem' }}>
        No data rows returned from query execution.
      </div>
    );
  }

  // 1. Identify Keys Dynamically
  const keys = Object.keys(data[0] || {});
  
  // Categorical/Date key (X-Axis)
  const xAxisKey = keys.find(k => {
    const val = data[0][k];
    const name = k.toLowerCase();
    // Prefer string categories or date strings/objects
    return (
      typeof val === 'string' && 
      name !== 'id' && 
      !name.endsWith('_id')
    );
  }) || keys.find(k => k.toLowerCase().includes('date') || k.toLowerCase().includes('month')) || keys[0];

  // Numeric Keys (Y-Axis Values)
  const yAxisKeys = keys.filter(k => {
    const val = data[0][k];
    const name = k.toLowerCase();
    return (
      (typeof val === 'number' || (typeof val === 'string' && !isNaN(Number(val)))) && 
      name !== 'id' && 
      !name.endsWith('_id')
    );
  });

  // Fallback to table if we don't have numeric keys, or if requested
  if (chartType === 'table' || yAxisKeys.length === 0) {
    return renderTable(data, keys);
  }

  // Formatting dates and converting string numeric values to numbers
  const formattedData = data.map(item => {
    const newItem = { ...item };

    // Cast string numbers to javascript numbers
    for (const yKey of yAxisKeys) {
      if (newItem[yKey] !== undefined && newItem[yKey] !== null) {
        newItem[yKey] = Number(newItem[yKey]);
      }
    }

    for (const key of keys) {
      if (key.toLowerCase().includes('date') && typeof newItem[key] === 'string') {
        try {
          // Format ISO date to short readable date e.g. YYYY-MM-DD
          newItem[key] = newItem[key].split('T')[0];
        } catch (_) {}
      }
    }
    return newItem;
  });

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          background: 'rgba(15, 23, 42, 0.95)',
          border: '1px solid var(--border-glass-active)',
          borderRadius: 'var(--radius-md)',
          padding: '0.75rem 1rem',
          boxShadow: 'var(--glass-shadow)',
          color: 'var(--text-primary)'
        }}>
          <p style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{`${xAxisKey}: ${label}`}</p>
          {payload.map((pld: any, index: number) => (
            <p key={index} style={{ color: pld.color || pld.fill, fontSize: '0.9rem' }}>
              {`${pld.name}: ${Number(pld.value).toLocaleString()}`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <ResponsiveContainer width="100%" height="100%">
      {chartType === 'line' ? (
        <LineChart data={formattedData} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
          <defs>
            <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--accent-cyan)" />
              <stop offset="100%" stopColor="var(--accent-violet)" />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis 
            dataKey={xAxisKey} 
            stroke="var(--text-muted)" 
            tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} 
            dy={10}
          />
          <YAxis 
            stroke="var(--text-muted)" 
            tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} 
            dx={-10}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ paddingTop: 10 }} />
          {yAxisKeys.map((yKey, index) => (
            <Line
              key={yKey}
              type="monotone"
              dataKey={yKey}
              name={formatLabel(yKey)}
              stroke={COLORS[index % COLORS.length]}
              strokeWidth={3}
              activeDot={{ r: 8, stroke: 'var(--bg-primary)', strokeWidth: 2 }}
              dot={{ strokeWidth: 2, r: 4 }}
            />
          ))}
        </LineChart>
      ) : chartType === 'pie' ? (
        <PieChart>
          <Pie
            data={formattedData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
            outerRadius={100}
            fill="#8884d8"
            dataKey={yAxisKeys[0]}
            nameKey={xAxisKey}
          >
            {formattedData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ paddingTop: 10 }} />
        </PieChart>
      ) : (
        // Default: Bar Chart
        <BarChart data={formattedData} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis 
            dataKey={xAxisKey} 
            stroke="var(--text-muted)" 
            tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} 
            dy={10}
          />
          <YAxis 
            stroke="var(--text-muted)" 
            tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} 
            dx={-10}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ paddingTop: 10 }} />
          {yAxisKeys.map((yKey, index) => (
            <Bar
              key={yKey}
              dataKey={yKey}
              name={formatLabel(yKey)}
              fill={COLORS[index % COLORS.length]}
              radius={[4, 4, 0, 0]}
              maxBarSize={60}
            />
          ))}
        </BarChart>
      )}
    </ResponsiveContainer>
  );
};

// Raw table renderer helper
function renderTable(data: any[], keys: string[]) {
  return (
    <div className="table-wrapper" style={{ width: '100%', maxHeight: '350px' }}>
      <table className="data-table">
        <thead>
          <tr>
            {keys.map(key => (
              <th key={key}>{formatLabel(key)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rIdx) => (
            <tr key={rIdx}>
              {keys.map(key => {
                let val = row[key];
                if (val instanceof Date) val = val.toLocaleDateString();
                else if (typeof val === 'object' && val !== null) val = JSON.stringify(val);
                return <td key={key}>{val !== null && val !== undefined ? String(val) : '-'}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatLabel(str: string): string {
  return str
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
}
