import React, { useEffect, useState } from 'react';
import api from '../../api';

export default function AdminDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get('/api/admin/dashboard')
      .then(res => setStats(res.data))
      .catch(err => {
        console.error('Dashboard API error:', err);
        setError(err.response?.data?.detail || 'Failed to load dashboard data');
      });
  }, []);

  if (error) return (
    <div className="p-6">
      <div className="bg-red-900/20 border border-red-500/50 rounded-xl p-6">
        <h2 className="text-red-400 text-lg font-semibold">Error Loading Dashboard</h2>
        <p className="text-red-300 mt-2">{error}</p>
        <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors">
          Retry
        </button>
      </div>
    </div>
  );

  if (!stats) return <div className="p-6"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div></div>;

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
        <p className="text-gray-400 mt-1">Overview of your platform</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Total Users</p>
              <p className="text-3xl font-bold text-white mt-1">{stats.total_users}</p>
            </div>
            <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
              <span className="text-2xl">👥</span>
            </div>
          </div>
          <p className="text-sm text-green-400 mt-2">+{stats.new_users_week} this week</p>
        </div>

        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Active Users</p>
              <p className="text-3xl font-bold text-white mt-1">{stats.active_users}</p>
            </div>
            <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center">
              <span className="text-2xl">✅</span>
            </div>
          </div>
        </div>

        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Total Swaps</p>
              <p className="text-3xl font-bold text-white mt-1">{stats.total_swaps}</p>
            </div>
            <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center">
              <span className="text-2xl">🎭</span>
            </div>
          </div>
          <p className="text-sm text-green-400 mt-2">+{stats.swaps_week} this week</p>
        </div>

        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Total Revenue</p>
              <p className="text-3xl font-bold text-white mt-1">${stats.total_revenue.toFixed(2)}</p>
            </div>
            <div className="w-12 h-12 bg-yellow-500/20 rounded-xl flex items-center justify-center">
              <span className="text-2xl">💰</span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <h2 className="text-lg font-semibold text-white mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <a href="/admin/users" className="block p-4 bg-gray-800 rounded-lg hover:bg-gray-750 transition-colors">
              <span className="text-white">Manage Users</span>
              <span className="text-gray-400 text-sm block mt-1">View, edit, and manage user accounts</span>
            </a>
            <a href="/admin/pricing" className="block p-4 bg-gray-800 rounded-lg hover:bg-gray-750 transition-colors">
              <span className="text-white">Update Pricing</span>
              <span className="text-gray-400 text-sm block mt-1">Modify credit costs and packages</span>
            </a>
            <a href="/admin/announcements" className="block p-4 bg-gray-800 rounded-lg hover:bg-gray-750 transition-colors">
              <span className="text-white">Post Announcement</span>
              <span className="text-gray-400 text-sm block mt-1">Create system-wide announcements</span>
            </a>
          </div>
        </div>

        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <h2 className="text-lg font-semibold text-white mb-4">System Info</h2>
          <div className="space-y-3">
            <div className="flex justify-between p-3 bg-gray-800 rounded-lg">
              <span className="text-gray-400">Platform Version</span>
              <span className="text-white">1.0.0</span>
            </div>
            <div className="flex justify-between p-3 bg-gray-800 rounded-lg">
              <span className="text-gray-400">API Status</span>
              <span className="text-green-400">Operational</span>
            </div>
            <div className="flex justify-between p-3 bg-gray-800 rounded-lg">
              <span className="text-gray-400">GPU Provider</span>
              <span className="text-white">RunPod</span>
            </div>
            <div className="flex justify-between p-3 bg-gray-800 rounded-lg">
              <span className="text-gray-400">Payment Method</span>
              <span className="text-white">USDT/USDC</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
