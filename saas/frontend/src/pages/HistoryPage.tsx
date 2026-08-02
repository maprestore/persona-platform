import React, { useEffect, useState } from 'react';
import api from '../api';

interface SwapHistory {
  id: string;
  swap_type: string;
  credits_used: number;
  status: string;
  created_at: string;
  output_file?: string;
}

interface Transaction {
  id: string;
  type: string;
  amount: number;
  credits_before: number;
  credits_after: number;
  status: string;
  description: string;
  created_at: string;
  tx_hash?: string;
}

export default function HistoryPage() {
  const [history, setHistory] = useState<SwapHistory[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [tab, setTab] = useState<'swaps' | 'transactions'>('swaps');
  const [page, setPage] = useState(1);
  const [swapsTotal, setSwapsTotal] = useState(0);
  const [txTotal, setTxTotal] = useState(0);
  const [filter, setFilter] = useState('all');
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [tab, page, filter]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (tab === 'swaps') {
        const res = await api.get(`/api/user/history?page=${page}`);
        setHistory(res.data.history);
        setSwapsTotal(res.data.total);
      } else {
        const res = await api.get(`/api/user/transactions?page=${page}`);
        setTransactions(res.data.transactions);
        setTxTotal(res.data.total);
      }
    } catch (err) {
      console.error('Failed to load history');
    } finally {
      setLoading(false);
    }
  };

  const getSwapIcon = (type: string) => {
    const icons: Record<string, string> = {
      face_swap: '🎭',
      video_swap: '🎬',
      portrait: '🖼️',
      background: '🎨',
      filter: '✨',
      voice: '🔊',
      voice_convert: '🎙️',
      translate: '🌐',
    };
    return icons[type] || '🔄';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500/20 text-green-400';
      case 'processing': return 'bg-yellow-500/20 text-yellow-400';
      case 'pending': return 'bg-blue-500/20 text-blue-400';
      case 'failed': return 'bg-red-500/20 text-red-400';
      case 'refunded': return 'bg-purple-500/20 text-purple-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  const getTransactionIcon = (type: string) => {
    const icons: Record<string, string> = {
      purchase: '💰',
      usage: '🎮',
      refund: '↩️',
      bonus: '🎁',
      withdrawal: '💸',
    };
    return icons[type] || '📝';
  };

  const handleDownload = (url: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `swap-result-${Date.now()}.jpg`;
    link.click();
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">History</h1>
          <p className="text-gray-400 mt-1">View your swap and transaction history</p>
        </div>
        <button className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-xl transition-colors flex items-center justify-center gap-2">
          <span>📥</span> Export
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => { setTab('swaps'); setPage(1); }}
          className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
            tab === 'swaps' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }`}
        >
          🎭 Swap History ({swapsTotal})
        </button>
        <button
          onClick={() => { setTab('transactions'); setPage(1); }}
          className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
            tab === 'transactions' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }`}
        >
          💰 Transactions ({txTotal})
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
        </div>
      ) : tab === 'swaps' ? (
        history.length === 0 ? (
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-12 text-center">
            <span className="text-5xl mb-4 block">📭</span>
            <p className="text-gray-400 text-lg">No swap history yet</p>
            <p className="text-gray-500 text-sm mt-2">Start your first transformation!</p>
          </div>
        ) : (
          <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
            <div className="divide-y divide-gray-800">
              {history.map((swap) => (
                <div
                  key={swap.id}
                  className="p-4 hover:bg-gray-800/30 transition-colors cursor-pointer"
                  onClick={() => setSelectedItem(swap)}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gray-800 rounded-xl flex items-center justify-center">
                      <span className="text-xl">{getSwapIcon(swap.swap_type)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium">
                        {swap.swap_type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </p>
                      <p className="text-sm text-gray-500">
                        {new Date(swap.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-red-400 font-medium">-{swap.credits_used} credits</p>
                      <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs ${getStatusColor(swap.status)}`}>
                        {swap.status}
                      </span>
                    </div>
                    <div className="w-10 h-10 bg-gray-800 rounded-xl flex items-center justify-center hover:bg-gray-700">
                      <span className="text-gray-400">→</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      ) : transactions.length === 0 ? (
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-12 text-center">
          <span className="text-5xl mb-4 block">📭</span>
          <p className="text-gray-400 text-lg">No transactions yet</p>
          <p className="text-gray-500 text-sm mt-2">Your purchase history will appear here</p>
        </div>
      ) : (
        <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
          <div className="divide-y divide-gray-800">
            {transactions.map((tx) => (
              <div
                key={tx.id}
                className="p-4 hover:bg-gray-800/30 transition-colors cursor-pointer"
                onClick={() => setSelectedItem(tx)}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gray-800 rounded-xl flex items-center justify-center">
                    <span className="text-xl">{getTransactionIcon(tx.type)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium">
                      {tx.description || tx.type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </p>
                    <p className="text-sm text-gray-500">
                      {new Date(tx.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`font-medium ${tx.amount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {tx.amount > 0 ? '+' : ''}{tx.amount} credits
                    </p>
                    <p className="text-xs text-gray-500">
                      {tx.credits_before} → {tx.credits_after}
                    </p>
                    <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs ${getStatusColor(tx.status)}`}>
                      {tx.status}
                    </span>
                  </div>
                  <div className="w-10 h-10 bg-gray-800 rounded-xl flex items-center justify-center hover:bg-gray-700">
                    <span className="text-gray-400">→</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pagination */}
      {((tab === 'swaps' ? swapsTotal : txTotal) > 20) && (
        <div className="mt-6 flex justify-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-xl transition-colors disabled:opacity-50"
          >
            ← Previous
          </button>
          <span className="px-4 py-2 text-gray-400">Page {page}</span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={(tab === 'swaps' ? history.length : transactions.length) < 20}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-xl transition-colors disabled:opacity-50"
          >
            Next →
          </button>
        </div>
      )}

      {/* Detail Modal */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedItem(null)}>
          <div className="bg-gray-900 rounded-2xl w-full max-w-md border border-gray-800" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-800 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Details</h3>
              <button onClick={() => setSelectedItem(null)} className="text-gray-400 hover:text-white">✕</button>
            </div>
            
            <div className="p-6 space-y-4">
              {selectedItem.swap_type && (
                <>
                  <div className="flex items-center gap-4 p-4 bg-gray-800 rounded-xl">
                    <div className="w-14 h-14 bg-gray-700 rounded-xl flex items-center justify-center">
                      <span className="text-3xl">{getSwapIcon(selectedItem.swap_type)}</span>
                    </div>
                    <div>
                      <p className="text-white font-semibold text-lg">
                        {selectedItem.swap_type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </p>
                      <p className="text-gray-400 text-sm">{new Date(selectedItem.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-gray-800 rounded-xl">
                      <p className="text-gray-400 text-sm">Status</p>
                      <span className={`inline-block mt-1 px-2 py-1 rounded text-sm ${getStatusColor(selectedItem.status)}`}>
                        {selectedItem.status}
                      </span>
                    </div>
                    <div className="p-4 bg-gray-800 rounded-xl">
                      <p className="text-gray-400 text-sm">Credits Used</p>
                      <p className="text-red-400 font-semibold text-lg mt-1">-{selectedItem.credits_used}</p>
                    </div>
                  </div>
                  
                  {selectedItem.output_file && (
                    <button
                      onClick={() => handleDownload(`/api/swap/${selectedItem.id}/result?token=${localStorage.getItem('token') || ''}`)}
                      className="w-full py-3 bg-green-600 hover:bg-green-500 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
                    >
                      📥 Download Result
                    </button>
                  )}
                </>
              )}
              
              {selectedItem.type && (
                <>
                  <div className="flex items-center gap-4 p-4 bg-gray-800 rounded-xl">
                    <div className="w-14 h-14 bg-gray-700 rounded-xl flex items-center justify-center">
                      <span className="text-3xl">{getTransactionIcon(selectedItem.type)}</span>
                    </div>
                    <div>
                      <p className="text-white font-semibold text-lg">
                        {selectedItem.description || selectedItem.type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </p>
                      <p className="text-gray-400 text-sm">{new Date(selectedItem.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-gray-800 rounded-xl">
                      <p className="text-gray-400 text-sm">Amount</p>
                      <p className={`font-semibold text-lg mt-1 ${selectedItem.amount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {selectedItem.amount > 0 ? '+' : ''}{selectedItem.amount} credits
                      </p>
                    </div>
                    <div className="p-4 bg-gray-800 rounded-xl">
                      <p className="text-gray-400 text-sm">Status</p>
                      <span className={`inline-block mt-1 px-2 py-1 rounded text-sm ${getStatusColor(selectedItem.status)}`}>
                        {selectedItem.status}
                      </span>
                    </div>
                  </div>
                  
                  <div className="p-4 bg-gray-800 rounded-xl">
                    <p className="text-gray-400 text-sm mb-1">Balance Change</p>
                    <p className="text-white">
                      {selectedItem.credits_before} → {selectedItem.credits_after} credits
                    </p>
                  </div>
                  
                  {selectedItem.tx_hash && (
                    <div className="p-4 bg-gray-800 rounded-xl">
                      <p className="text-gray-400 text-sm mb-1">Transaction Hash</p>
                      <code className="text-sm text-indigo-400 break-all">{selectedItem.tx_hash}</code>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
