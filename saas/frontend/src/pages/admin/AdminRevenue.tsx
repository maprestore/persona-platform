import React, { useEffect, useState } from 'react';
import api from '../../api';

interface RevenueData {
  total_revenue: number;
  monthly_revenue: number;
  daily_revenue: Array<{ date: string; amount: number }>;
  top_features: Array<{ feature: string; usage: number; revenue: number }>;
  recent_transactions: Array<{
    id: string;
    user: string;
    amount: number;
    type: string;
    date: string;
  }>;
}

export default function AdminRevenue() {
  const [data, setData] = useState<RevenueData | null>(null);
  const [period, setPeriod] = useState('30d');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRevenue();
  }, [period]);

  const loadRevenue = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/api/admin/revenue?period=${period}`);
      setData(res.data);
    } catch (err) {
      console.error('Failed to load revenue data');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getMaxValue = () => {
    if (!data?.daily_revenue?.length) return 100;
    return Math.max(...data.daily_revenue.map(d => d.amount), 100);
  };

  if (loading && !data) {
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
          <h1 className="text-2xl font-bold text-white">Revenue Analytics</h1>
          <p className="text-gray-400 mt-1">Track your platform's financial performance</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {['7d', '30d', '90d', '1y'].map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                period === p
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {p === '7d' ? '7 Days' : p === '30d' ? '30 Days' : p === '90d' ? '90 Days' : '1 Year'}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-gradient-to-br from-green-500/20 to-green-600/20 border border-green-500/30 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-400 text-sm font-medium">Total Revenue</p>
              <p className="text-3xl font-bold text-white mt-1">{formatCurrency(data?.total_revenue || 0)}</p>
            </div>
            <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center">
              <span className="text-2xl">💰</span>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/20 border border-blue-500/30 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-400 text-sm font-medium">This Month</p>
              <p className="text-3xl font-bold text-white mt-1">{formatCurrency(data?.monthly_revenue || 0)}</p>
            </div>
            <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
              <span className="text-2xl">📈</span>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/20 border border-purple-500/30 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-400 text-sm font-medium">Avg. Daily</p>
              <p className="text-3xl font-bold text-white mt-1">
                {formatCurrency((data?.daily_revenue?.reduce((a, b) => a + b.amount, 0) || 0) / (data?.daily_revenue?.length || 1))}
              </p>
            </div>
            <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center">
              <span className="text-2xl">📊</span>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-yellow-500/20 to-yellow-600/20 border border-yellow-500/30 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-yellow-400 text-sm font-medium">Pending</p>
              <p className="text-3xl font-bold text-white mt-1">
                {formatCurrency(data?.recent_transactions?.filter(t => t.type === 'pending').reduce((a, b) => a + b.amount, 0) || 0)}
              </p>
            </div>
            <div className="w-12 h-12 bg-yellow-500/20 rounded-xl flex items-center justify-center">
              <span className="text-2xl">⏳</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Chart */}
        <div className="lg:col-span-2 bg-gray-900 rounded-xl border border-gray-800 p-6">
          <h2 className="text-lg font-semibold text-white mb-6">Revenue Over Time</h2>
          
          {/* Simple Bar Chart */}
          <div className="h-64 flex items-end gap-1">
            {data?.daily_revenue?.slice(-30).map((item, i) => (
              <div
                key={i}
                className="flex-1 bg-gradient-to-t from-indigo-600 to-purple-600 rounded-t-sm hover:from-indigo-500 hover:to-purple-500 transition-colors relative group"
                style={{ height: `${(item.amount / getMaxValue()) * 100}%` }}
              >
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                  {formatCurrency(item.amount)}
                </div>
              </div>
            ))}
          </div>
          
          {/* Date Labels */}
          <div className="flex justify-between mt-2 text-xs text-gray-500">
            <span>{data?.daily_revenue?.[0]?.date || '-'}</span>
            <span>{data?.daily_revenue?.[data.daily_revenue.length - 1]?.date || '-'}</span>
          </div>
        </div>

        {/* Top Features */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <h2 className="text-lg font-semibold text-white mb-6">Revenue by Feature</h2>
          
          <div className="space-y-4">
            {data?.top_features?.map((feature, i) => (
              <div key={i} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-gray-300 capitalize">{feature.feature.replace('_', ' ')}</span>
                  <span className="text-white font-medium">{formatCurrency(feature.revenue)}</span>
                </div>
                <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
                    style={{ width: `${(feature.usage / Math.max(...(data?.top_features?.map(f => f.usage) || [1]))) * 100}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>{feature.usage} uses</span>
                  <span>{((feature.usage / (data?.top_features?.reduce((a, b) => a + b.usage, 0) || 1)) * 100).toFixed(1)}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="mt-6 bg-gray-900 rounded-xl border border-gray-800 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-white">Recent Transactions</h2>
          <button className="text-indigo-400 hover:text-indigo-300 text-sm font-medium">
            View All →
          </button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left p-4 text-gray-400 font-medium">User</th>
                <th className="text-left p-4 text-gray-400 font-medium">Type</th>
                <th className="text-left p-4 text-gray-400 font-medium">Amount</th>
                <th className="text-left p-4 text-gray-400 font-medium">Status</th>
                <th className="text-left p-4 text-gray-400 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {data?.recent_transactions?.map((tx) => (
                <tr key={tx.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="p-4 text-white font-medium">{tx.user}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-xs ${
                      tx.type === 'purchase' ? 'bg-green-500/20 text-green-400' :
                      tx.type === 'usage' ? 'bg-blue-500/20 text-blue-400' :
                      'bg-gray-500/20 text-gray-400'
                    }`}>
                      {tx.type}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className={`font-medium ${tx.amount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {tx.amount > 0 ? '+' : ''}{formatCurrency(tx.amount)}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className="px-2 py-1 rounded text-xs bg-green-500/20 text-green-400">
                      Confirmed
                    </span>
                  </td>
                  <td className="p-4 text-gray-400 text-sm">{tx.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Export Options */}
      <div className="mt-6 flex flex-wrap gap-4">
        <button className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors flex items-center gap-2">
          <span>📥</span> Export CSV
        </button>
        <button className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors flex items-center gap-2">
          <span>📊</span> Generate Report
        </button>
        <button className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors flex items-center gap-2">
          <span>📧</span> Email Report
        </button>
      </div>
    </div>
  );
}
