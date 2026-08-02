import React, { useEffect, useState } from 'react';
import api from '../../api';

interface ActivityLog {
  id: string;
  admin_id: string;
  admin_username: string;
  action: string;
  target_type: string;
  target_id: string;
  details: any;
  ip_address: string;
  created_at: string;
}

export default function AdminActivity() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState('7d');

  useEffect(() => {
    loadLogs();
  }, [page, filter, dateRange]);

  const loadLogs = async () => {
    try {
      const res = await api.get(`/api/admin/activity?page=${page}&filter=${filter}&date=${dateRange}&search=${search}`);
      setLogs(res.data.logs);
      setTotal(res.data.total);
    } catch (err) {
      console.error('Failed to load activity logs');
    }
  };

  const getActionIcon = (action: string) => {
    if (action.includes('create')) return '➕';
    if (action.includes('update') || action.includes('edit')) return '✏️';
    if (action.includes('delete')) return '🗑️';
    if (action.includes('login')) return '🔑';
    if (action.includes('approve')) return '✅';
    if (action.includes('reject')) return '❌';
    if (action.includes('refund')) return '💸';
    return '📝';
  };

  const getActionColor = (action: string) => {
    if (action.includes('create')) return 'bg-green-500/20 text-green-400';
    if (action.includes('update') || action.includes('edit')) return 'bg-blue-500/20 text-blue-400';
    if (action.includes('delete')) return 'bg-red-500/20 text-red-400';
    if (action.includes('login')) return 'bg-purple-500/20 text-purple-400';
    if (action.includes('approve')) return 'bg-green-500/20 text-green-400';
    if (action.includes('reject')) return 'bg-red-500/20 text-red-400';
    return 'bg-gray-500/20 text-gray-400';
  };

  const formatDetails = (details: any) => {
    if (!details) return null;
    if (typeof details === 'string') return details;
    
    return Object.entries(details).map(([key, value]) => (
      <span key={key} className="inline-flex items-center gap-1 mr-3">
        <span className="text-gray-500">{key}:</span>
        <span className="text-gray-300">{String(value)}</span>
      </span>
    ));
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Activity Logs</h1>
          <p className="text-gray-400 mt-1">Audit trail of admin actions</p>
        </div>
        <div className="flex gap-3">
          <button className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors flex items-center gap-2">
            <span>📥</span> Export Logs
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 mb-6">
        <div className="flex flex-col md:flex-row flex-wrap items-stretch md:items-center gap-4">
          {/* Search */}
          <div className="flex-1 min-w-0 md:min-w-64">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search logs..."
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500"
            />
          </div>
          
          {/* Action Filter */}
          <select
            value={filter}
            onChange={(e) => { setFilter(e.target.value); setPage(1); }}
            className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500"
          >
            <option value="all">All Actions</option>
            <option value="create">Create</option>
            <option value="update">Update</option>
            <option value="delete">Delete</option>
            <option value="login">Login</option>
            <option value="approve">Approve</option>
            <option value="reject">Reject</option>
          </select>
          
          {/* Date Range */}
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500"
          >
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
            <option value="all">All Time</option>
          </select>
          
          <button
            onClick={loadLogs}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors"
          >
            🔍 Search
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <p className="text-gray-400 text-sm">Total Actions</p>
          <p className="text-2xl font-bold text-white mt-1">{total}</p>
        </div>
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <p className="text-gray-400 text-sm">Today</p>
          <p className="text-2xl font-bold text-blue-400 mt-1">
            {logs.filter(l => new Date(l.created_at).toDateString() === new Date().toDateString()).length}
          </p>
        </div>
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <p className="text-gray-400 text-sm">Unique Admins</p>
          <p className="text-2xl font-bold text-purple-400 mt-1">
            {new Set(logs.map(l => l.admin_id)).size}
          </p>
        </div>
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <p className="text-gray-400 text-sm">Critical Actions</p>
          <p className="text-2xl font-bold text-red-400 mt-1">
            {logs.filter(l => l.action.includes('delete') || l.action.includes('reject')).length}
          </p>
        </div>
      </div>

      {/* Logs List */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <div className="divide-y divide-gray-800">
          {logs.map((log) => (
            <div key={log.id} className="p-4 hover:bg-gray-800/30 transition-colors">
              <div className="flex items-start gap-4">
                {/* Icon */}
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${getActionColor(log.action)}`}>
                  <span>{getActionIcon(log.action)}</span>
                </div>
                
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-white font-medium">{log.admin_username}</span>
                    <span className="text-gray-500">•</span>
                    <span className={`px-2 py-0.5 rounded text-xs ${getActionColor(log.action)}`}>
                      {log.action}
                    </span>
                    <span className="text-gray-500">•</span>
                    <span className="text-gray-400 text-sm">{log.target_type}</span>
                  </div>
                  
                  {log.details && (
                    <p className="text-sm text-gray-400 mb-1">
                      {formatDetails(log.details)}
                    </p>
                  )}
                  
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>🕐 {new Date(log.created_at).toLocaleString()}</span>
                    <span>📍 {log.ip_address || 'Unknown'}</span>
                  </div>
                </div>
                
                {/* Target ID */}
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-gray-500">Target</p>
                  <p className="text-xs text-gray-400 font-mono">
                    {log.target_id ? log.target_id.slice(0, 8) + '...' : '-'}
                  </p>
                </div>
              </div>
            </div>
          ))}
          
          {logs.length === 0 && (
            <div className="p-12 text-center text-gray-500">
              No activity logs found
            </div>
          )}
        </div>
      </div>

      {/* Pagination */}
      {total > 50 && (
        <div className="mt-4 flex justify-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1 bg-gray-800 rounded text-white disabled:opacity-50"
          >
            Previous
          </button>
          <span className="px-3 py-1 text-gray-400">Page {page}</span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={logs.length < 50}
            className="px-3 py-1 bg-gray-800 rounded text-white disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
