import React, { useEffect, useState } from 'react';
import api from '../../api';

interface Withdrawal {
  id: string;
  user_id: string;
  username: string;
  email: string;
  amount: number;
  wallet_address: string;
  network: string;
  status: string;
  tx_hash?: string;
  created_at: string;
  processed_at?: string;
}

export default function AdminWithdrawals() {
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [filter, setFilter] = useState('pending');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<Withdrawal | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadWithdrawals();
  }, [page, filter]);

  const loadWithdrawals = async () => {
    try {
      const res = await api.get(`/api/admin/withdrawals?page=${page}&status=${filter}`);
      setWithdrawals(res.data.withdrawals);
      setTotal(res.data.total);
    } catch (err) {
      console.error('Failed to load withdrawals');
    }
  };

  const handleApprove = async (id: string) => {
    const txHash = prompt('Enter transaction hash after sending:');
    if (!txHash) return;
    
    setProcessing(true);
    try {
      await api.post(`/api/admin/withdrawals/${id}/approve`, { tx_hash: txHash });
      setSelected(null);
      loadWithdrawals();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to approve');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async (id: string) => {
    const reason = prompt('Enter rejection reason:');
    if (!reason) return;
    
    setProcessing(true);
    try {
      await api.post(`/api/admin/withdrawals/${id}/reject`, { reason });
      setSelected(null);
      loadWithdrawals();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to reject');
    } finally {
      setProcessing(false);
    }
  };

  const handleBulkApprove = async () => {
    const pendingIds = withdrawals
      .filter(w => w.status === 'pending')
      .map(w => w.id);
    
    if (pendingIds.length === 0) return;
    if (!confirm(`Approve ${pendingIds.length} withdrawals?`)) return;
    
    setProcessing(true);
    try {
      await api.post('/api/admin/withdrawals/bulk-approve', { ids: pendingIds });
      loadWithdrawals();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to bulk approve');
    } finally {
      setProcessing(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-500/20 text-yellow-400',
    approved: 'bg-green-500/20 text-green-400',
    processing: 'bg-blue-500/20 text-blue-400',
    completed: 'bg-green-500/20 text-green-400',
    rejected: 'bg-red-500/20 text-red-400',
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Withdrawal Requests</h1>
          <p className="text-gray-400 mt-1">Process user withdrawal requests</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleBulkApprove}
            disabled={processing || !withdrawals.some(w => w.status === 'pending')}
            className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            ✓ Bulk Approve
          </button>
          <button className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors">
            📥 Export
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <p className="text-gray-400 text-sm">Pending</p>
          <p className="text-2xl font-bold text-yellow-400 mt-1">
            {withdrawals.filter(w => w.status === 'pending').length}
          </p>
        </div>
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <p className="text-gray-400 text-sm">Processing</p>
          <p className="text-2xl font-bold text-blue-400 mt-1">
            {withdrawals.filter(w => w.status === 'processing').length}
          </p>
        </div>
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <p className="text-gray-400 text-sm">Completed Today</p>
          <p className="text-2xl font-bold text-green-400 mt-1">
            {withdrawals.filter(w => w.status === 'completed').length}
          </p>
        </div>
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <p className="text-gray-400 text-sm">Total Pending</p>
          <p className="text-2xl font-bold text-white mt-1">
            {formatCurrency(withdrawals.filter(w => w.status === 'pending').reduce((a, b) => a + b.amount, 0))}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        {['all', 'pending', 'approved', 'processing', 'completed', 'rejected'].map((f) => (
          <button
            key={f}
            onClick={() => { setFilter(f); setPage(1); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
              filter === f
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="p-4 text-left">
                  <input type="checkbox" className="rounded" />
                </th>
                <th className="p-4 text-left text-gray-400 font-medium">User</th>
                <th className="p-4 text-left text-gray-400 font-medium">Amount</th>
                <th className="p-4 text-left text-gray-400 font-medium">Wallet</th>
                <th className="p-4 text-left text-gray-400 font-medium">Network</th>
                <th className="p-4 text-left text-gray-400 font-medium">Status</th>
                <th className="p-4 text-left text-gray-400 font-medium">Date</th>
                <th className="p-4 text-right text-gray-400 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {withdrawals.map((w) => (
                <tr key={w.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="p-4">
                    <input type="checkbox" className="rounded" />
                  </td>
                  <td className="p-4">
                    <div>
                      <p className="text-white font-medium">{w.username}</p>
                      <p className="text-sm text-gray-400">{w.email}</p>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="text-white font-semibold">{formatCurrency(w.amount)}</span>
                  </td>
                  <td className="p-4">
                    <span className="text-gray-400 text-sm font-mono">
                      {w.wallet_address.slice(0, 8)}...{w.wallet_address.slice(-6)}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className="px-2 py-1 bg-gray-800 rounded text-xs text-gray-300">
                      {w.network}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-xs ${statusColors[w.status] || 'bg-gray-500/20 text-gray-400'}`}>
                      {w.status}
                    </span>
                  </td>
                  <td className="p-4 text-sm text-gray-400">
                    {new Date(w.created_at).toLocaleString()}
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setSelected(w)}
                        className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm text-white"
                      >
                        View
                      </button>
                      {w.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleApprove(w.id)}
                            disabled={processing}
                            className="px-3 py-1 bg-green-600 hover:bg-green-500 rounded text-sm text-white disabled:opacity-50"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleReject(w.id)}
                            disabled={processing}
                            className="px-3 py-1 bg-red-600 hover:bg-red-500 rounded text-sm text-white disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {withdrawals.length === 0 && (
          <div className="p-12 text-center text-gray-500">
            No withdrawal requests found
          </div>
        )}
      </div>

      {/* Pagination */}
      {total > 20 && (
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
            disabled={withdrawals.length < 20}
            className="px-3 py-1 bg-gray-800 rounded text-white disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}

      {/* Detail Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl w-full max-w-lg border border-gray-800">
            <div className="p-6 border-b border-gray-800">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">Withdrawal Details</h3>
                <button
                  onClick={() => setSelected(null)}
                  className="text-gray-400 hover:text-white"
                >
                  ✕
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-gray-400 text-sm">User</p>
                  <p className="text-white font-medium">{selected.username}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Email</p>
                  <p className="text-white">{selected.email}</p>
                </div>
              </div>
              
              <div className="p-4 bg-gray-800 rounded-xl">
                <p className="text-gray-400 text-sm mb-1">Amount</p>
                <p className="text-3xl font-bold text-white">{formatCurrency(selected.amount)}</p>
              </div>
              
              <div>
                <p className="text-gray-400 text-sm mb-1">Wallet Address</p>
                <p className="text-white font-mono text-sm break-all bg-gray-800 p-3 rounded-lg">
                  {selected.wallet_address}
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-gray-400 text-sm">Network</p>
                  <p className="text-white">{selected.network}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Status</p>
                  <span className={`px-2 py-1 rounded text-xs ${statusColors[selected.status]}`}>
                    {selected.status}
                  </span>
                </div>
              </div>
              
              {selected.tx_hash && (
                <div>
                  <p className="text-gray-400 text-sm mb-1">Transaction Hash</p>
                  <p className="text-green-400 font-mono text-sm break-all bg-gray-800 p-3 rounded-lg">
                    {selected.tx_hash}
                  </p>
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-400">Created</p>
                  <p className="text-white">{new Date(selected.created_at).toLocaleString()}</p>
                </div>
                {selected.processed_at && (
                  <div>
                    <p className="text-gray-400">Processed</p>
                    <p className="text-white">{new Date(selected.processed_at).toLocaleString()}</p>
                  </div>
                )}
              </div>
            </div>
            
            {selected.status === 'pending' && (
              <div className="p-6 border-t border-gray-800 flex gap-3">
                <button
                  onClick={() => handleApprove(selected.id)}
                  disabled={processing}
                  className="flex-1 py-3 bg-green-600 hover:bg-green-500 text-white font-medium rounded-xl transition-colors disabled:opacity-50"
                >
                  {processing ? 'Processing...' : '✓ Approve & Send'}
                </button>
                <button
                  onClick={() => handleReject(selected.id)}
                  disabled={processing}
                  className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white font-medium rounded-xl transition-colors disabled:opacity-50"
                >
                  ✕ Reject
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
