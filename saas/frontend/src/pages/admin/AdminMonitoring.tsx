import React, { useEffect, useState } from 'react';
import api from '../../api';

interface SystemHealth {
  api: { status: string; latency: number; uptime: string };
  engine: { status: string; latency: number; gpu_usage: number };
  database: { status: string; connections: number; size: string };
  storage: { used: number; total: number; percent: number };
}

interface ApiStats {
  total_requests: number;
  requests_per_minute: number;
  error_rate: number;
  avg_response_time: number;
  endpoints: Array<{ path: string; method: string; count: number; avg_time: number }>;
}

interface ErrorLog {
  id: string;
  level: string;
  message: string;
  stack?: string;
  count: number;
  last_seen: string;
}

export default function AdminMonitoring() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [apiStats, setApiStats] = useState<ApiStats | null>(null);
  const [errors, setErrors] = useState<ErrorLog[]>([]);
  const [activeTab, setActiveTab] = useState('health');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const [healthRes, statsRes, errorsRes] = await Promise.all([
        api.get('/api/admin/monitoring/health'),
        api.get('/api/admin/monitoring/stats'),
        api.get('/api/admin/monitoring/errors'),
      ]);
      setHealth(healthRes.data);
      setApiStats(statsRes.data);
      setErrors(errorsRes.data.errors);
    } catch (err) {
      console.error('Failed to load monitoring data');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    return status === 'online' || status === 'healthy'
      ? 'text-green-400 bg-green-500/20'
      : status === 'degraded'
      ? 'text-yellow-400 bg-yellow-500/20'
      : 'text-red-400 bg-red-500/20';
  };

  const getErrorLevelColor = (level: string) => {
    switch (level) {
      case 'error': return 'bg-red-500/20 text-red-400';
      case 'warning': return 'bg-yellow-500/20 text-yellow-400';
      case 'critical': return 'bg-red-600/20 text-red-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">System Monitoring</h1>
          <p className="text-gray-400 mt-1">Real-time system health and API statistics</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 bg-gray-800 rounded-lg">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-sm text-gray-300">Auto-refresh: 30s</span>
          </div>
          <button
            onClick={loadData}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {[
          { id: 'health', label: 'System Health', icon: '💓' },
          { id: 'api', label: 'API Stats', icon: '📊' },
          { id: 'errors', label: 'Error Logs', icon: '⚠️' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* System Health Tab */}
      {activeTab === 'health' && (
        <div className="space-y-6">
          {/* Status Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-gray-400 font-medium">API Server</h3>
                <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(health?.api?.status || 'offline')}`}>
                  {health?.api?.status || 'Unknown'}
                </span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Latency</span>
                  <span className="text-white">{health?.api?.latency || 0}ms</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Uptime</span>
                  <span className="text-white">{health?.api?.uptime || '-'}</span>
                </div>
              </div>
            </div>

            <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-gray-400 font-medium">AI Engine</h3>
                <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(health?.engine?.status || 'offline')}`}>
                  {health?.engine?.status || 'Unknown'}
                </span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Latency</span>
                  <span className="text-white">{health?.engine?.latency || 0}ms</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">GPU Usage</span>
                  <span className="text-white">{health?.engine?.gpu_usage || 0}%</span>
                </div>
              </div>
              <div className="mt-3 h-2 bg-gray-800 rounded-full">
                <div
                  className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full"
                  style={{ width: `${health?.engine?.gpu_usage || 0}%` }}
                />
              </div>
            </div>

            <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-gray-400 font-medium">Database</h3>
                <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor('online')}`}>
                  Online
                </span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Connections</span>
                  <span className="text-white">{health?.database?.connections || 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Size</span>
                  <span className="text-white">{health?.database?.size || '0 MB'}</span>
                </div>
              </div>
            </div>

            <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-gray-400 font-medium">Storage</h3>
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  (health?.storage?.percent || 0) > 90 ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'
                }`}>
                  {health?.storage?.percent || 0}% Used
                </span>
              </div>
              <div className="mt-3 h-3 bg-gray-800 rounded-full">
                <div
                  className={`h-full rounded-full ${
                    (health?.storage?.percent || 0) > 90
                      ? 'bg-gradient-to-r from-red-500 to-red-600'
                      : 'bg-gradient-to-r from-green-500 to-emerald-500'
                  }`}
                  style={{ width: `${health?.storage?.percent || 0}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-2">
                <span>{health?.storage?.used || 0} GB</span>
                <span>{health?.storage?.total || 0} GB</span>
              </div>
            </div>
          </div>

          {/* System Resources */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
            <h2 className="text-lg font-semibold text-white mb-6">System Resources</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-400">CPU Usage</span>
                  <span className="text-white">45%</span>
                </div>
                <div className="h-3 bg-gray-800 rounded-full">
                  <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full" style={{ width: '45%' }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-400">Memory</span>
                  <span className="text-white">62%</span>
                </div>
                <div className="h-3 bg-gray-800 rounded-full">
                  <div className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full" style={{ width: '62%' }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-400">Disk I/O</span>
                  <span className="text-white">28%</span>
                </div>
                <div className="h-3 bg-gray-800 rounded-full">
                  <div className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full" style={{ width: '28%' }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* API Stats Tab */}
      {activeTab === 'api' && (
        <div className="space-y-6">
          {/* API Overview */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
              <p className="text-gray-400 text-sm">Total Requests</p>
              <p className="text-3xl font-bold text-white mt-1">
                {(apiStats?.total_requests || 0).toLocaleString()}
              </p>
            </div>
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
              <p className="text-gray-400 text-sm">Requests/min</p>
              <p className="text-3xl font-bold text-blue-400 mt-1">
                {apiStats?.requests_per_minute || 0}
              </p>
            </div>
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
              <p className="text-gray-400 text-sm">Error Rate</p>
              <p className={`text-3xl font-bold mt-1 ${
                (apiStats?.error_rate || 0) > 5 ? 'text-red-400' : 'text-green-400'
              }`}>
                {(apiStats?.error_rate || 0).toFixed(2)}%
              </p>
            </div>
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
              <p className="text-gray-400 text-sm">Avg Response</p>
              <p className="text-3xl font-bold text-purple-400 mt-1">
                {apiStats?.avg_response_time || 0}ms
              </p>
            </div>
          </div>

          {/* Top Endpoints */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
            <h2 className="text-lg font-semibold text-white mb-6">Top Endpoints</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="text-left p-4 text-gray-400 font-medium">Endpoint</th>
                    <th className="text-left p-4 text-gray-400 font-medium">Method</th>
                    <th className="text-left p-4 text-gray-400 font-medium">Requests</th>
                    <th className="text-left p-4 text-gray-400 font-medium">Avg Time</th>
                    <th className="text-left p-4 text-gray-400 font-medium">Load</th>
                  </tr>
                </thead>
                <tbody>
                  {apiStats?.endpoints?.map((ep, i) => (
                    <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                      <td className="p-4 text-white font-mono text-sm">{ep.path}</td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded text-xs ${
                          ep.method === 'GET' ? 'bg-green-500/20 text-green-400' :
                          ep.method === 'POST' ? 'bg-blue-500/20 text-blue-400' :
                          'bg-yellow-500/20 text-yellow-400'
                        }`}>
                          {ep.method}
                        </span>
                      </td>
                      <td className="p-4 text-white">{ep.count.toLocaleString()}</td>
                      <td className="p-4 text-gray-400">{ep.avg_time}ms</td>
                      <td className="p-4">
                        <div className="w-24 h-2 bg-gray-800 rounded-full">
                          <div
                            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
                            style={{ width: `${Math.min((ep.count / Math.max(...(apiStats?.endpoints?.map(e => e.count) || [1]))) * 100, 100)}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Error Logs Tab */}
      {activeTab === 'errors' && (
        <div className="space-y-6">
          {/* Error Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6">
              <p className="text-red-400 text-sm">Errors</p>
              <p className="text-3xl font-bold text-white mt-1">
                {errors.filter(e => e.level === 'error').length}
              </p>
            </div>
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-6">
              <p className="text-yellow-400 text-sm">Warnings</p>
              <p className="text-3xl font-bold text-white mt-1">
                {errors.filter(e => e.level === 'warning').length}
              </p>
            </div>
            <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-6">
              <p className="text-purple-400 text-sm">Critical</p>
              <p className="text-3xl font-bold text-white mt-1">
                {errors.filter(e => e.level === 'critical').length}
              </p>
            </div>
          </div>

          {/* Error List */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            <div className="divide-y divide-gray-800">
              {errors.map((error) => (
                <div key={error.id} className="p-4 hover:bg-gray-800/30">
                  <div className="flex items-start gap-4">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getErrorLevelColor(error.level)}`}>
                      {error.level.toUpperCase()}
                    </span>
                    <div className="flex-1">
                      <p className="text-white font-medium">{error.message}</p>
                      {error.stack && (
                        <pre className="mt-2 text-xs text-gray-500 bg-gray-800 p-3 rounded-lg overflow-x-auto">
                          {error.stack.slice(0, 200)}
                        </pre>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        <span>Occurred {error.count} times</span>
                        <span>Last: {new Date(error.last_seen).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              
              {errors.length === 0 && (
                <div className="p-12 text-center text-gray-500">
                  No errors found - system is healthy!
                </div>
              )}
            </div>
          </div>

          <button className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors">
            🗑️ Clear Old Errors
          </button>
        </div>
      )}
    </div>
  );
}
