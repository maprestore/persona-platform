import React, { useEffect, useState } from 'react';
import api from '../api';

interface ApiKey {
  id: string;
  name: string;
  key_preview: string;
  is_active: boolean;
  created_at: string;
  last_used: string | null;
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKey, setNewKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'keys' | 'docs'>('keys');

  useEffect(() => {
    loadKeys();
  }, []);

  const loadKeys = async () => {
    try {
      const res = await api.get('/api/user/api-keys');
      setKeys(res.data.keys);
    } catch (err) {
      console.error('Failed to load API keys');
    }
  };

  const handleCreate = async () => {
    if (!newKeyName) return;
    setLoading(true);
    try {
      const res = await api.post('/api/user/api-keys', { name: newKeyName });
      setNewKey(res.data.key);
      setNewKeyName('');
      setShowCreateModal(false);
      loadKeys();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to create key');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (keyId: string) => {
    if (!confirm('Are you sure you want to delete this API key? This action cannot be undone.')) return;
    try {
      await api.delete(`/api/user/api-keys/${keyId}`);
      loadKeys();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to delete key');
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const copyExample = `curl -X POST https://api.persona.studio/api/swap \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -F "source=@source.jpg" \\
  -F "target=@target.jpg" \\
  -F "swap_type=face_swap"`;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">API Keys</h1>
          <p className="text-gray-400 mt-1">Manage your API keys for programmatic access</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-medium rounded-xl transition-all shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2"
        >
          <span>+</span> Create Key
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('keys')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
            activeTab === 'keys' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }`}
        >
          🔑 Your Keys ({keys.length})
        </button>
        <button
          onClick={() => setActiveTab('docs')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
            activeTab === 'docs' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }`}
        >
          📚 API Docs
        </button>
      </div>

      {/* New Key Display */}
      {newKey && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-6 mb-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <span className="text-2xl">✅</span>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-green-400 mb-2">API Key Created!</h3>
              <p className="text-sm text-gray-300 mb-4">Copy this key now. It won't be shown again for security reasons.</p>
              <div className="bg-gray-800 rounded-xl p-4 flex items-center gap-3">
                <code className="flex-1 text-sm text-white break-all font-mono">{newKey}</code>
                <button
                  onClick={() => handleCopy(newKey)}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm text-white transition-colors flex items-center gap-2"
                >
                  📋 Copy
                </button>
              </div>
            </div>
            <button
              onClick={() => setNewKey(null)}
              className="text-gray-400 hover:text-white"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {activeTab === 'keys' ? (
        <>
          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
              <p className="text-gray-400 text-sm">Total Keys</p>
              <p className="text-2xl font-bold text-white mt-1">{keys.length}</p>
            </div>
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
              <p className="text-gray-400 text-sm">Active Keys</p>
              <p className="text-2xl font-bold text-green-400 mt-1">{keys.filter(k => k.is_active).length}</p>
            </div>
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
              <p className="text-gray-400 text-sm">Used Today</p>
              <p className="text-2xl font-bold text-blue-400 mt-1">0</p>
            </div>
          </div>

          {/* Keys List */}
          <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
            <div className="p-4 border-b border-gray-800">
              <h2 className="text-lg font-semibold text-white">Your API Keys</h2>
            </div>
            {keys.length === 0 ? (
              <div className="p-12 text-center">
                <span className="text-5xl mb-4 block">🔑</span>
                <p className="text-gray-400 text-lg">No API keys yet</p>
                <p className="text-gray-500 text-sm mt-2">Create your first key to get started</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-800">
                {keys.map((key) => (
                  <div key={key.id} className="p-4 hover:bg-gray-800/30 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-gray-800 rounded-xl flex items-center justify-center">
                          <span className="text-lg">🔑</span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-white font-medium">{key.name}</p>
                            <span className={`px-2 py-0.5 rounded text-xs ${
                              key.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                            }`}>
                              {key.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                          <p className="text-sm text-gray-400 font-mono mt-1">{key.key_preview}</p>
                          <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                            <span>Created: {new Date(key.created_at).toLocaleDateString()}</span>
                            {key.last_used && (
                              <span>Last used: {new Date(key.last_used).toLocaleDateString()}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleCopy(key.key_preview)}
                          className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-300 transition-colors"
                        >
                          Copy
                        </button>
                        <button
                          onClick={() => handleDelete(key.id)}
                          className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 rounded-lg text-sm text-red-400 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        /* API Documentation */
        <div className="space-y-6">
          {/* Quick Start */}
          <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
            <h2 className="text-lg font-semibold text-white mb-4">Quick Start</h2>
            <p className="text-gray-400 mb-4">Include your API key in the Authorization header:</p>
            <div className="bg-gray-800 rounded-xl p-4 overflow-x-auto">
              <code className="text-sm text-indigo-400 whitespace-pre">{copyExample}</code>
            </div>
            <button
              onClick={() => handleCopy(copyExample)}
              className="mt-3 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm transition-colors"
            >
              📋 Copy Example
            </button>
          </div>

          {/* Endpoints */}
          <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
            <h2 className="text-lg font-semibold text-white mb-4">API Endpoints</h2>
            <div className="space-y-3">
              {[
                { method: 'POST', path: '/api/swap', desc: 'Perform face swap', credits: '1-5' },
                { method: 'POST', path: '/api/upload', desc: 'Upload a file', credits: '0' },
                { method: 'GET', path: '/api/swap/{id}/status', desc: 'Check swap status', credits: '0' },
                { method: 'GET', path: '/api/user/credits', desc: 'Get credit balance', credits: '0' },
                { method: 'POST', path: '/api/credits/purchase', desc: 'Purchase credits', credits: '0' },
              ].map((endpoint, i) => (
                <div key={i} className="flex items-center gap-4 p-3 bg-gray-800/50 rounded-xl">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    endpoint.method === 'GET' ? 'bg-green-500/20 text-green-400' :
                    endpoint.method === 'POST' ? 'bg-blue-500/20 text-blue-400' :
                    'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    {endpoint.method}
                  </span>
                  <code className="text-sm text-white flex-1">{endpoint.path}</code>
                  <span className="text-sm text-gray-400">{endpoint.desc}</span>
                  <span className="text-xs text-indigo-400">{endpoint.credits} cr</span>
                </div>
              ))}
            </div>
          </div>

          {/* Rate Limits */}
          <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
            <h2 className="text-lg font-semibold text-white mb-4">Rate Limits</h2>
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 bg-gray-800 rounded-xl">
                <p className="text-gray-400 text-sm">Requests/min</p>
                <p className="text-2xl font-bold text-white mt-1">120</p>
              </div>
              <div className="p-4 bg-gray-800 rounded-xl">
                <p className="text-gray-400 text-sm">Requests/hour</p>
                <p className="text-2xl font-bold text-white mt-1">1,000</p>
              </div>
              <div className="p-4 bg-gray-800 rounded-xl">
                <p className="text-gray-400 text-sm">Burst limit</p>
                <p className="text-2xl font-bold text-white mt-1">50</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowCreateModal(false)}>
          <div className="bg-gray-900 rounded-2xl w-full max-w-md border border-gray-800" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-800 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Create API Key</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-white">✕</button>
            </div>
            <div className="p-6">
              <label className="block text-sm text-gray-400 mb-2">Key Name</label>
              <input
                type="text"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="e.g., My App, Production, Testing"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500"
                autoFocus
              />
              <p className="text-xs text-gray-500 mt-2">Give your key a descriptive name to identify it later</p>
              
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!newKeyName || loading}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                  ) : (
                    'Create Key'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
