import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../contexts/AuthContext';

interface UserStats {
  credits: number;
  swap_count: number;
  api_key_count: number;
}

interface Activity {
  id: string;
  type: string;
  description: string;
  credits?: number;
  status: string;
  date: string;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [recentActivity, setRecentActivity] = useState<Activity[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const [meRes, statsRes, historyRes, announcementsRes] = await Promise.all([
        api.get('/api/auth/me'),
        api.get('/api/user/stats'),
        api.get('/api/user/history?limit=5'),
        api.get('/api/announcements'),
      ]);
      
      setStats({
        credits: meRes.data.credits,
        swap_count: statsRes.data.swap_count,
        api_key_count: statsRes.data.api_key_count,
      });
      
      setRecentActivity(historyRes.data.history.map((h: any) => ({
        id: h.id,
        type: 'swap',
        description: h.swap_type.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
        credits: h.credits_used,
        status: h.status,
        date: h.created_at,
      })));
      
      setAnnouncements(announcementsRes.data.announcements);
    } catch (err) {
      console.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const quickActions = [
    {
      title: 'Face Swap',
      description: 'Swap faces in photos',
      icon: '🎭',
      credits: 1,
      path: '/app/swap?type=face_swap',
      color: 'from-purple-500 to-pink-500',
    },
    {
      title: 'Video Swap',
      description: 'Transform videos',
      icon: '🎬',
      credits: 5,
      path: '/app/swap?type=video_swap',
      color: 'from-blue-500 to-cyan-500',
    },
    {
      title: 'Live Portrait',
      description: 'Animate portraits',
      icon: '🖼️',
      credits: 3,
      path: '/app/swap?type=portrait',
      color: 'from-orange-500 to-red-500',
    },
    {
      title: 'Background',
      description: 'Remove/replace bg',
      icon: '🎨',
      credits: 1,
      path: '/app/swap?type=background',
      color: 'from-green-500 to-teal-500',
    },
    {
      title: 'AI Filter',
      description: 'Apply AI filters',
      icon: '✨',
      credits: 0.5,
      path: '/app/swap?type=filter',
      color: 'from-yellow-500 to-orange-500',
    },
    {
      title: 'Voice Clone',
      description: 'Clone any voice',
      icon: '🔊',
      credits: 2,
      path: '/app/swap?type=voice',
      color: 'from-indigo-500 to-purple-500',
    },
  ];

  const usageStats = [
    { label: 'This Week', swaps: 12, credits: 45 },
    { label: 'This Month', swaps: 48, credits: 180 },
    { label: 'All Time', swaps: stats?.swap_count || 0, credits: 0 },
  ];

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Welcome Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">
          Welcome back, <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">{user?.username}</span> 👋
        </h1>
        <p className="text-gray-400 mt-1">Here's what's happening with your account</p>
      </div>

      {/* Announcements */}
      {announcements.length > 0 && (
        <div className="mb-6 space-y-3">
          {announcements.map((a: any) => (
            <div key={a.id} className={`p-4 rounded-xl border backdrop-blur-sm ${
              a.type === 'warning' ? 'bg-yellow-500/10 border-yellow-500/20' :
              a.type === 'maintenance' ? 'bg-orange-500/10 border-orange-500/20' :
              'bg-blue-500/10 border-blue-500/20'
            }`}>
              <div className="flex items-start gap-3">
                <span className="text-xl">
                  {a.type === 'warning' ? '⚠️' : a.type === 'maintenance' ? '🔧' : 'ℹ️'}
                </span>
                <div>
                  <h3 className="font-medium text-white">{a.title}</h3>
                  <p className="text-sm text-gray-300 mt-1">{a.message}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-gradient-to-br from-indigo-600/20 to-purple-600/20 border border-indigo-500/30 rounded-2xl p-6 hover:shadow-lg hover:shadow-indigo-500/10 transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Credits Balance</p>
              <p className="text-4xl font-bold text-white mt-1">{stats?.credits || 0}</p>
              <p className="text-xs text-gray-500 mt-2">≈ ${(stats?.credits || 0) * 0.2} value</p>
            </div>
            <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-2xl flex items-center justify-center shadow-lg">
              <span className="text-2xl">💎</span>
            </div>
          </div>
          <Link
            to="/app/credits"
            className="mt-4 block text-center py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-xl transition-colors"
          >
            Buy Credits
          </Link>
        </div>

        <div className="bg-gradient-to-br from-purple-600/20 to-pink-600/20 border border-purple-500/30 rounded-2xl p-6 hover:shadow-lg hover:shadow-purple-500/10 transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Total Swaps</p>
              <p className="text-4xl font-bold text-white mt-1">{stats?.swap_count || 0}</p>
              <p className="text-xs text-green-400 mt-2">↑ 12% this week</p>
            </div>
            <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-lg">
              <span className="text-2xl">🎭</span>
            </div>
          </div>
          <Link
            to="/app/swap"
            className="mt-4 block text-center py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-xl transition-colors"
          >
            Start Swapping
          </Link>
        </div>

        <div className="bg-gradient-to-br from-green-600/20 to-teal-600/20 border border-green-500/30 rounded-2xl p-6 hover:shadow-lg hover:shadow-green-500/10 transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">API Keys</p>
              <p className="text-4xl font-bold text-white mt-1">{stats?.api_key_count || 0}</p>
              <p className="text-xs text-gray-500 mt-2">Active keys</p>
            </div>
            <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-teal-500 rounded-2xl flex items-center justify-center shadow-lg">
              <span className="text-2xl">🔑</span>
            </div>
          </div>
          <Link
            to="/app/api-keys"
            className="mt-4 block text-center py-2.5 bg-green-600 hover:bg-green-500 text-white text-sm font-medium rounded-xl transition-colors"
          >
            Manage Keys
          </Link>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">AI Tools</h2>
          <Link to="/app/swap" className="text-sm text-indigo-400 hover:text-indigo-300">
            View All →
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {quickActions.map((action, i) => (
            <Link
              key={i}
              to={action.path}
              className="group bg-gray-900 border border-gray-800 rounded-2xl p-4 hover:border-gray-700 transition-all hover:-translate-y-1 hover:shadow-xl"
            >
              <div className={`w-12 h-12 bg-gradient-to-br ${action.color} rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                <span className="text-2xl">{action.icon}</span>
              </div>
              <h3 className="text-white font-medium text-sm">{action.title}</h3>
              <p className="text-gray-500 text-xs mt-1">{action.description}</p>
              <div className="mt-3 flex items-center gap-1">
                <span className="text-xs text-indigo-400">{action.credits} credit</span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-white">Recent Activity</h2>
            <Link to="/app/history" className="text-sm text-indigo-400 hover:text-indigo-300">
              View All →
            </Link>
          </div>
          
          {recentActivity.length === 0 ? (
            <div className="text-center py-12">
              <span className="text-4xl mb-4 block">📭</span>
              <p className="text-gray-400">No activity yet</p>
              <Link to="/app/swap" className="mt-4 inline-block px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-lg transition-colors">
                Start Your First Swap
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-center gap-4 p-3 bg-gray-800/50 rounded-xl hover:bg-gray-800 transition-colors">
                  <div className="w-10 h-10 bg-gray-800 rounded-xl flex items-center justify-center">
                    <span className="text-lg">
                      {activity.type === 'swap' ? '🎭' : '💰'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium">{activity.description}</p>
                    <p className="text-xs text-gray-500">{new Date(activity.date).toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    {activity.credits && (
                      <p className="text-red-400 text-sm">-{activity.credits} credits</p>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      activity.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                      activity.status === 'processing' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-gray-500/20 text-gray-400'
                    }`}>
                      {activity.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Usage Stats */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-white mb-6">Usage Overview</h2>
          
          <div className="space-y-4">
            {usageStats.map((stat, i) => (
              <div key={i} className="p-4 bg-gray-800/50 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-400 text-sm">{stat.label}</span>
                  <span className="text-white font-medium">{stat.swaps} swaps</span>
                </div>
                <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
                    style={{ width: `${Math.min((stat.swaps / 100) * 100, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Pricing Quick Reference */}
          <div className="mt-6">
            <h3 className="text-sm font-medium text-gray-400 mb-3">Credit Costs</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex items-center justify-between p-2 bg-gray-800/30 rounded-lg">
                <span className="text-gray-400">Face Swap</span>
                <span className="text-indigo-400">1</span>
              </div>
              <div className="flex items-center justify-between p-2 bg-gray-800/30 rounded-lg">
                <span className="text-gray-400">Video</span>
                <span className="text-indigo-400">5</span>
              </div>
              <div className="flex items-center justify-between p-2 bg-gray-800/30 rounded-lg">
                <span className="text-gray-400">Portrait</span>
                <span className="text-indigo-400">3</span>
              </div>
              <div className="flex items-center justify-between p-2 bg-gray-800/30 rounded-lg">
                <span className="text-gray-400">Background</span>
                <span className="text-indigo-400">1</span>
              </div>
              <div className="flex items-center justify-between p-2 bg-gray-800/30 rounded-lg">
                <span className="text-gray-400">Filter</span>
                <span className="text-indigo-400">0.5</span>
              </div>
              <div className="flex items-center justify-between p-2 bg-gray-800/30 rounded-lg">
                <span className="text-gray-400">Voice</span>
                <span className="text-indigo-400">2</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Upgrade Banner */}
      {(stats?.credits || 0) < 10 && (
        <div className="mt-6 bg-gradient-to-r from-indigo-600/20 to-purple-600/20 border border-indigo-500/30 rounded-2xl p-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <span className="text-4xl">⚡</span>
              <div>
                <h3 className="text-lg font-semibold text-white">Running low on credits?</h3>
                <p className="text-gray-400">Get more credits to keep creating amazing content</p>
              </div>
            </div>
            <Link
              to="/app/credits"
              className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-medium rounded-xl transition-all shadow-lg shadow-indigo-500/25"
            >
              Buy Credits
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
