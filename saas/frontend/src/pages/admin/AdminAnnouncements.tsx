import React, { useEffect, useState } from 'react';
import api from '../../api';

export default function AdminAnnouncements() {
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState('info');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadAnnouncements();
  }, []);

  const loadAnnouncements = () => {
    api.get('/api/announcements').then(res => setAnnouncements(res.data.announcements));
  };

  const handleCreate = async () => {
    if (!title || !message) return;
    setLoading(true);
    try {
      await api.post('/api/admin/announcements', { title, message, type });
      setTitle('');
      setMessage('');
      setType('info');
      loadAnnouncements();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to create');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Announcements</h1>
        <p className="text-gray-400 mt-1">Create system-wide announcements</p>
      </div>

      {/* Create Form */}
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 mb-6">
        <h2 className="text-lg font-semibold text-white mb-4">New Announcement</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Announcement title..."
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Announcement message..."
              rows={3}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">Type</label>
            <div className="flex gap-3">
              {['info', 'warning', 'maintenance'].map((t) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={`px-4 py-2 rounded-lg capitalize transition-colors ${
                    type === t
                      ? t === 'info' ? 'bg-blue-600 text-white' :
                        t === 'warning' ? 'bg-yellow-600 text-white' :
                        'bg-orange-600 text-white'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={handleCreate}
            disabled={!title || !message || loading}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-6 py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create Announcement'}
          </button>
        </div>
      </div>

      {/* Announcements List */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <div className="p-4 border-b border-gray-800">
          <h2 className="text-lg font-semibold text-white">Active Announcements</h2>
        </div>
        {announcements.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No announcements</div>
        ) : (
          <div className="divide-y divide-gray-800">
            {announcements.map((a) => (
              <div key={a.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        a.type === 'warning' ? 'bg-yellow-500/20 text-yellow-400' :
                        a.type === 'maintenance' ? 'bg-orange-500/20 text-orange-400' :
                        'bg-blue-500/20 text-blue-400'
                      }`}>
                        {a.type}
                      </span>
                      <h3 className="text-white font-medium">{a.title}</h3>
                    </div>
                    <p className="text-gray-400 text-sm">{a.message}</p>
                    <p className="text-xs text-gray-500 mt-2">{new Date(a.created_at).toLocaleString()}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
