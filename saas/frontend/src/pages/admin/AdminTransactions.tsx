import React, { useEffect, useState } from 'react';
import api from '../../api';

export default function AdminTransactions() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    loadTransactions();
  }, [page]);

  const loadTransactions = () => {
    api.get(`/api/admin/transactions?page=${page}`).then(res => {
      setTransactions(res.data.transactions);
      setTotal(res.data.total);
    });
  };

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Transactions</h1>
        <p className="text-gray-400 mt-1">{total} total transactions</p>
      </div>

      {/* Transactions Table */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left p-4 text-gray-400 font-medium">Type</th>
                <th className="text-left p-4 text-gray-400 font-medium">User ID</th>
                <th className="text-left p-4 text-gray-400 font-medium">Amount</th>
                <th className="text-left p-4 text-gray-400 font-medium">Status</th>
                <th className="text-left p-4 text-gray-400 font-medium">TX Hash</th>
                <th className="text-left p-4 text-gray-400 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr key={tx.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-xs ${
                      tx.type === 'purchase' ? 'bg-green-500/20 text-green-400' :
                      tx.type === 'usage' ? 'bg-blue-500/20 text-blue-400' :
                      'bg-gray-500/20 text-gray-400'
                    }`}>
                      {tx.type}
                    </span>
                  </td>
                  <td className="p-4 text-sm text-gray-400 font-mono">{tx.user_id}</td>
                  <td className="p-4">
                    <span className={`font-medium ${tx.amount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {tx.amount > 0 ? '+' : ''}{tx.amount}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-xs ${
                      tx.status === 'confirmed' ? 'bg-green-500/20 text-green-400' :
                      tx.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-red-500/20 text-red-400'
                    }`}>
                      {tx.status}
                    </span>
                  </td>
                  <td className="p-4 text-sm text-gray-400 font-mono max-w-[200px] truncate">
                    {tx.tx_hash || '-'}
                  </td>
                  <td className="p-4 text-sm text-gray-400">
                    {new Date(tx.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
            disabled={transactions.length < 20}
            className="px-3 py-1 bg-gray-800 rounded text-white disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
