import React, { useState } from 'react';
import { Clock, TrendingUp, AlertCircle, Search, Trash2, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { VoiceQuery } from '../types';

interface QueryHistorySidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

export function QueryHistorySidebar({ isOpen, onToggle }: QueryHistorySidebarProps) {
  const { state, dispatch } = useApp();
  const { queryHistory } = state;
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'error'>('all');

  const filteredQueries = queryHistory.filter(query => {
    const matchesSearch = query.query.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || query.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleSelectQuery = (query: VoiceQuery) => {
    dispatch({ type: 'SET_CURRENT_QUERY', payload: query });
    dispatch({ type: 'SET_TRANSCRIPT', payload: query.query });
  };

  const handleDeleteQuery = (queryId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    dispatch({ type: 'DELETE_QUERY_FROM_HISTORY', payload: queryId });
  };

  const handleClearAll = () => {
    if (window.confirm('Are you sure you want to clear all query history?')) {
      dispatch({ type: 'CLEAR_QUERY_HISTORY' });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <TrendingUp className="text-green-500" size={14} />;
      case 'error':
        return <AlertCircle className="text-red-500" size={14} />;
      default:
        return <Clock className="text-yellow-500" size={14} />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'border-l-green-400';
      case 'error':
        return 'border-l-red-400';
      default:
        return 'border-l-yellow-400';
    }
  };

  const formatTime = (timestamp: Date) => {
    const now = new Date();
    const diff = now.getTime() - new Date(timestamp).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 dark:bg-black dark:bg-opacity-70 z-40 lg:hidden"
          onClick={onToggle}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed top-0 right-0 h-full bg-white dark:bg-gray-800 shadow-2xl z-50 transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        w-80 lg:w-96
      `}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2">
            <Clock size={20} />
            Query History
          </h2>
          <button
            onClick={onToggle}
            className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Search and Filters */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-600 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500" size={16} />
            <input
              type="text"
              placeholder="Search queries..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter size={16} className="text-gray-500 dark:text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'success' | 'error')}
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="all">All Status</option>
              <option value="success">Success</option>
              <option value="error">Error</option>
            </select>
          </div>

          {queryHistory.length > 0 && (
            <button
              onClick={handleClearAll}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900 dark:hover:bg-opacity-20 rounded-lg transition-colors"
            >
              <Trash2 size={14} />
              Clear All
            </button>
          )}
        </div>

        {/* Query List */}
        <div className="flex-1 overflow-y-auto">
          {filteredQueries.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center px-4">
              {queryHistory.length === 0 ? (
                <>
                  <Clock className="text-gray-300 dark:text-gray-600 mb-3" size={48} />
                  <p className="text-gray-500 dark:text-gray-400 font-medium">No queries yet</p>
                  <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                    Your voice queries will appear here
                  </p>
                </>
              ) : (
                <>
                  <Search className="text-gray-300 dark:text-gray-600 mb-3" size={48} />
                  <p className="text-gray-500 dark:text-gray-400 font-medium">No matching queries</p>
                  <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                    Try adjusting your search or filter
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="p-4 space-y-3">
              {filteredQueries.map((query) => (
                <div
                  key={query.id}
                  className={`
                    group relative p-4 rounded-lg border-l-4 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 
                    cursor-pointer transition-all duration-200 hover:shadow-md
                    ${getStatusColor(query.status)}
                  `}
                  onClick={() => handleSelectQuery(query)}
                >
                  {/* Status and Time */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(query.status)}
                      <span className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                        {query.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {formatTime(query.timestamp)}
                      </span>
                      <button
                        onClick={(e) => handleDeleteQuery(query.id, e)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 rounded transition-all"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>

                  {/* Query Text */}
                  <p className="text-sm text-gray-800 dark:text-gray-200 mb-2 line-clamp-3 leading-relaxed">
                    {query.query}
                  </p>

                  {/* Result Info */}
                  {query.result && (
                    <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                      <span className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                        {query.result.metadata.rowCount} rows
                      </span>
                      <span className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                        {query.result.metadata.chartType}
                      </span>
                    </div>
                  )}

                  {/* Error Message */}
                  {query.error && (
                    <div className="mt-2 p-2 bg-red-50 dark:bg-red-900 dark:bg-opacity-20 border border-red-200 dark:border-red-800 rounded text-xs text-red-700 dark:text-red-400">
                      {query.error}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Stats */}
        {queryHistory.length > 0 && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700">
            <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
              <span>Total: {queryHistory.length}</span>
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  {queryHistory.filter(q => q.status === 'success').length}
                </span>
                <span className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                  {queryHistory.filter(q => q.status === 'error').length}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}