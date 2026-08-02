import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../api';
import { Layers, Search, Filter, Play, Star, Zap, Image, Mic, Paintbrush } from 'lucide-react';

const typeIcons: Record<string, React.ReactNode> = {
  face_swap: <Image className="w-5 h-5" />,
  portrait: <Layers className="w-5 h-5" />,
  background: <Paintbrush className="w-5 h-5" />,
  filter: <Paintbrush className="w-5 h-5" />,
  voice_clone: <Mic className="w-5 h-5" />,
  voice_convert: <Mic className="w-5 h-5" />,
};

const typeColors: Record<string, string> = {
  face_swap: 'from-purple-500 to-pink-500',
  portrait: 'from-blue-500 to-cyan-500',
  background: 'from-green-500 to-emerald-500',
  filter: 'from-orange-500 to-red-500',
  voice_clone: 'from-indigo-500 to-violet-500',
  voice_convert: 'from-teal-500 to-cyan-500',
};

interface Template {
  id: string;
  name: string;
  type: string;
  description: string;
  credits: number;
  params: Record<string, any>;
}

export default function TemplatesPage() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [sourceId, setSourceId] = useState('');
  const [executing, setExecuting] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const res = await api.get('/api/templates');
      setTemplates(res.data.templates);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const executeTemplate = async () => {
    if (!selectedTemplate || !sourceId) return;
    setExecuting(true);
    try {
      await api.post('/api/swap/from-template', {
        template_id: selectedTemplate.id,
        source_id: sourceId,
      });
      alert('Transformation started! Check your history for results.');
      setSelectedTemplate(null);
      setSourceId('');
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to execute template');
    } finally {
      setExecuting(false);
    }
  };

  const filtered = templates.filter(t => {
    const matchSearch = t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.description.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === 'all' || t.type === typeFilter;
    return matchSearch && matchType;
  });

  const types = [...new Set(templates.map(t => t.type))];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-3 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl">
            <Layers className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white">Templates</h1>
            <p className="text-gray-400 text-sm">Pre-built transformations ready to use</p>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search templates..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setTypeFilter('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                typeFilter === 'all' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              All
            </button>
            {types.map(type => (
              <button
                key={type}
                onClick={() => setTypeFilter(type)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize ${
                  typeFilter === type ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                {type.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map(template => (
              <div
                key={template.id}
                onClick={() => setSelectedTemplate(template)}
                className={`group relative bg-gray-800/50 border rounded-xl p-5 cursor-pointer transition-all hover:scale-[1.02] ${
                  selectedTemplate?.id === template.id
                    ? 'border-indigo-500 ring-2 ring-indigo-500/30'
                    : 'border-gray-700/50 hover:border-gray-600'
                }`}
              >
                <div className={`inline-flex p-2 rounded-lg bg-gradient-to-r ${typeColors[template.type] || 'from-gray-500 to-gray-600'} text-white mb-3`}>
                  {typeIcons[template.type] || <Zap className="w-5 h-5" />}
                </div>
                <h3 className="text-white font-semibold mb-1">{template.name}</h3>
                <p className="text-gray-400 text-sm mb-3 line-clamp-2">{template.description}</p>
                <div className="flex items-center justify-between">
                  <span className="text-indigo-400 text-sm font-medium flex items-center gap-1">
                    <Zap className="w-3 h-3" />
                    {template.credits} credits
                  </span>
                  <span className="text-xs text-gray-500 capitalize bg-gray-700/50 px-2 py-1 rounded">
                    {template.type.replace('_', ' ')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {selectedTemplate && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 max-w-md w-full">
              <h2 className="text-xl font-bold text-white mb-2">{selectedTemplate.name}</h2>
              <p className="text-gray-400 text-sm mb-4">{selectedTemplate.description}</p>

              <label className="block text-sm text-gray-400 mb-1">Source File ID</label>
              <input
                type="text"
                value={sourceId}
                onChange={(e) => setSourceId(e.target.value)}
                placeholder="Enter uploaded file ID"
                className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 mb-4"
              />

              <div className="flex items-center justify-between mb-4 p-3 bg-gray-900/50 rounded-lg">
                <span className="text-gray-400">Cost</span>
                <span className="text-indigo-400 font-semibold">{selectedTemplate.credits} credits</span>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setSelectedTemplate(null)}
                  className="flex-1 px-4 py-2.5 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={executeTemplate}
                  disabled={!sourceId || executing}
                  className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {executing ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                  Execute
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
