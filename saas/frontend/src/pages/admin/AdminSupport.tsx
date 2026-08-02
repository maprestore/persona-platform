import React, { useEffect, useState } from 'react';
import api from '../../api';

interface SupportMessage {
  id: string;
  user_id: string | null;
  name: string;
  email: string;
  subject: string;
  category: string;
  message: string;
  status: string;
  priority: string;
  admin_reply: string | null;
  replied_at: string | null;
  created_at: string;
  updated_at: string;
}

interface Stats {
  total: number;
  open: number;
  in_progress: number;
  resolved: number;
  closed: number;
}

const statusColors: Record<string, string> = {
  open: 'bg-yellow-500/20 text-yellow-400',
  in_progress: 'bg-blue-500/20 text-blue-400',
  resolved: 'bg-green-500/20 text-green-400',
  closed: 'bg-gray-500/20 text-gray-400',
};

const categoryLabels: Record<string, string> = {
  general: 'General',
  bug: 'Bug Report',
  feature: 'Feature Request',
  billing: 'Billing',
  other: 'Other',
};

export default function AdminSupport() {
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, open: 0, in_progress: 0, resolved: 0, closed: 0 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<SupportMessage | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replyStatus, setReplyStatus] = useState('in_progress');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    loadStats();
    loadMessages();
  }, [page, statusFilter, search]);

  const loadStats = async () => {
    try {
      const res = await api.get('/api/support/stats');
      setStats(res.data);
    } catch {}
  };

  const loadMessages = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20', status: statusFilter, search });
      const res = await api.get(`/api/support/messages?${params}`);
      setMessages(res.data.messages);
      setTotalPages(res.data.pages);
    } catch {} finally {
      setLoading(false);
    }
  };

  const handleReply = async () => {
    if (!selected || !replyText.trim()) return;
    setSending(true);
    try {
      await api.put(`/api/support/messages/${selected.id}`, { admin_reply: replyText, status: replyStatus });
      setSelected(null);
      setReplyText('');
      loadMessages();
      loadStats();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to send reply');
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this message?')) return;
    try {
      await api.delete(`/api/support/messages/${id}`);
      loadMessages();
      loadStats();
    } catch {}
  };

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Support Messages</h1>
        <p className="text-gray-400 mt-1">Manage and reply to user inquiries from the Contact Us form</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
        {[
          { label: 'Total', value: stats.total, color: 'text-white' },
          { label: 'Open', value: stats.open, color: 'text-yellow-400' },
          { label: 'In Progress', value: stats.in_progress, color: 'text-blue-400' },
          { label: 'Resolved', value: stats.resolved, color: 'text-green-400' },
          { label: 'Closed', value: stats.closed, color: 'text-gray-400' },
        ].map((s) => (
          <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-gray-400 text-sm">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
        >
          <option value="all">All Status</option>
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search by name, email, or subject..."
          className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 flex-1 min-w-[200px]"
        />
      </div>

      {/* Messages Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading...</div>
        ) : messages.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No messages found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800 text-left">
                  <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase">From</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Subject</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Category</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Status</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Date</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {messages.map((msg) => (
                  <tr key={msg.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-white text-sm font-medium">{msg.name}</p>
                      <p className="text-gray-500 text-xs">{msg.email}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300 max-w-[200px] truncate">{msg.subject}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-400">{categoryLabels[msg.category] || msg.category}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full ${statusColors[msg.status] || 'bg-gray-500/20 text-gray-400'}`}>
                        {msg.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {new Date(msg.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => { setSelected(msg); setReplyText(msg.admin_reply || ''); setReplyStatus(msg.status); }}
                          className="text-xs px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
                        >
                          View
                        </button>
                        <button
                          onClick={() => handleDelete(msg.id)}
                          className="text-xs px-3 py-1 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-lg transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 text-sm text-gray-400 hover:text-white disabled:opacity-50 transition-colors"
            >
              Previous
            </button>
            <span className="text-sm text-gray-400">Page {page} of {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1 text-sm text-gray-400 hover:text-white disabled:opacity-50 transition-colors"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Detail / Reply Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-800 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">{selected.subject}</h2>
                <p className="text-sm text-gray-400">From {selected.name} ({selected.email})</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-white text-xl">✕</button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <p className="text-xs text-gray-500 uppercase mb-1">Category</p>
                <p className="text-sm text-gray-300">{categoryLabels[selected.category] || selected.category}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase mb-1">Message</p>
                <p className="text-sm text-gray-300 whitespace-pre-wrap bg-gray-800 rounded-lg p-4">{selected.message}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase mb-1">Submitted</p>
                <p className="text-sm text-gray-400">{new Date(selected.created_at).toLocaleString()}</p>
              </div>

              {selected.admin_reply && (
                <div>
                  <p className="text-xs text-gray-500 uppercase mb-1">Previous Reply</p>
                  <p className="text-sm text-gray-300 whitespace-pre-wrap bg-indigo-500/10 border border-indigo-500/20 rounded-lg p-4">{selected.admin_reply}</p>
                </div>
              )}

              <div className="border-t border-gray-800 pt-4">
                <p className="text-xs text-gray-500 uppercase mb-2">Your Reply</p>
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  rows={4}
                  placeholder="Type your reply..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none mb-3"
                />
                <div className="flex items-center justify-between">
                  <select
                    value={replyStatus}
                    onChange={(e) => setReplyStatus(e.target.value)}
                    className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                  >
                    <option value="in_progress">In Progress</option>
                    <option value="resolved">Resolved</option>
                    <option value="closed">Closed</option>
                  </select>
                  <button
                    onClick={handleReply}
                    disabled={sending || !replyText.trim()}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-800 text-white text-sm rounded-lg transition-colors"
                  >
                    {sending ? 'Sending...' : 'Send Reply'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
