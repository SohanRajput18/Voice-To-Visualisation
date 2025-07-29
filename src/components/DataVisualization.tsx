import React, { useMemo } from 'react';
import Plot from 'react-plotly.js';
import { Download, ZoomIn, ZoomOut, BarChart3, TrendingUp, PieChart } from 'lucide-react';
import { QueryResult } from '../types';
import { useApp } from '../contexts/AppContext';

interface DataVisualizationProps {
  result: QueryResult;
}

export function DataVisualization({ result }: DataVisualizationProps) {
  const { state } = useApp();
  const { theme } = state;

  const plotData = useMemo(() => {
    return result.data.map(item => {
      if (item.type === 'pie') {
        return {
          ...item,
          hole: 0.3, // Creates a donut chart effect
          textfont: { size: 12, color: '#1F2937' },
          marker: {
            ...item.marker,
            line: { color: '#FFFFFF', width: 2 }
          }
        };
      }
      return {
        ...item,
        marker: {
          ...item.marker,
          line: { color: '#1F2937', width: 1 }
        }
      };
    });
  }, [result.data]);

  const layout = useMemo(() => ({
    title: {
      text: result.metadata.title,
      font: { size: 20, color: theme === 'dark' ? '#F9FAFB' : '#1F2937', family: 'Inter, sans-serif' },
      x: 0.5,
      xanchor: 'center'
    },
    xaxis: {
      title: result.metadata.columns[0] || 'X-axis',
      gridcolor: theme === 'dark' ? '#374151' : '#E5E7EB',
      titlefont: { size: 14, color: theme === 'dark' ? '#D1D5DB' : '#374151' },
      tickfont: { size: 12, color: theme === 'dark' ? '#9CA3AF' : '#6B7280' }
    },
    yaxis: {
      title: result.metadata.columns[1] || 'Y-axis',
      gridcolor: theme === 'dark' ? '#374151' : '#E5E7EB',
      titlefont: { size: 14, color: theme === 'dark' ? '#D1D5DB' : '#374151' },
      tickfont: { size: 12, color: theme === 'dark' ? '#9CA3AF' : '#6B7280' }
    },
    plot_bgcolor: theme === 'dark' ? '#1F2937' : '#FAFAFA',
    paper_bgcolor: theme === 'dark' ? '#111827' : '#FFFFFF',
    margin: { l: 70, r: 50, t: 80, b: 70 },
    showlegend: result.data.length > 1,
    legend: {
      orientation: 'h',
      x: 0.5,
      xanchor: 'center',
      y: -0.2,
      font: { size: 12, color: theme === 'dark' ? '#D1D5DB' : '#374151' }
    },
    colorway: theme === 'dark' 
      ? ['#60A5FA', '#34D399', '#FBBF24', '#F87171', '#A78BFA', '#F472B6', '#2DD4BF', '#FB923C']
      : ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316']
  }), [result.metadata, theme]);

  const config = {
    responsive: true,
    displayModeBar: true,
    modeBarButtonsToRemove: ['pan2d', 'lasso2d', 'select2d'],
    displaylogo: false,
    toImageButtonOptions: {
      format: 'png',
      filename: 'visualization',
      height: 600,
      width: 800,
      scale: 1,
    },
  };

  const getChartIcon = () => {
    switch (result.metadata.chartType) {
      case 'pie':
        return <PieChart size={16} className="text-purple-500" />;
      case 'line':
        return <TrendingUp size={16} className="text-green-500" />;
      default:
        return <BarChart3 size={16} className="text-blue-500" />;
    }
  };

  const handleExport = () => {
    const plotElement = document.querySelector('.js-plotly-plot') as any;
    if (plotElement) {
      window.Plotly.downloadImage(plotElement, {
        format: 'png',
        width: 800,
        height: 600,
        filename: 'visualization',
      });
    }
  };

  return (
    <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-700 rounded-xl shadow-lg border border-gray-200 dark:border-gray-600 p-6 mb-6 transition-all duration-300">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            {getChartIcon()}
            <h3 className="text-xl font-bold text-gray-800 dark:text-white">
              {result.metadata.title}
            </h3>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
            {result.metadata.description}
          </p>
        </div>
        
        <div className="flex gap-2">
          <div className="hidden sm:flex items-center gap-4 mr-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{result.metadata.rowCount}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Data Points</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-gray-700 dark:text-gray-300 capitalize">{result.metadata.chartType}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Chart Type</div>
            </div>
          </div>
          
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-lg transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
          >
            <Download size={16} />
            <span className="hidden sm:inline">Export</span>
          </button>
        </div>
      </div>

      <div className="relative bg-white dark:bg-gray-700 rounded-lg shadow-inner border border-gray-100 dark:border-gray-600 p-4 transition-all duration-300">
        <Plot
          data={plotData}
          layout={layout}
          config={config}
          className="w-full"
          style={{ width: '100%', height: '450px' }}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            <span className="text-gray-600 dark:text-gray-300">
              <span className="font-medium">{result.metadata.rowCount}</span> data points
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span className="text-gray-600 dark:text-gray-300">
              <span className="font-medium capitalize">{result.metadata.chartType}</span> visualization
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
            <span className="text-gray-600 dark:text-gray-300">
              Interactive & exportable
            </span>
          </div>
        </div>
        
        <div className="text-xs text-gray-500 dark:text-gray-400">
          Generated at {new Date().toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
}