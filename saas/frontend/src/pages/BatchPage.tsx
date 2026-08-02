import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../api';
import { Layers, Upload, Play, CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';

interface BatchJob {
  id: string;
  file_id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
}

const swapTypes = [
  { value: 'face_swap', label: 'Face Swap', credits: 1 },
  { value: 'portrait', label: 'Live Portrait', credits: 3 },
  { value: 'background', label: 'Background', credits: 1 },
  { value: 'filter', label: 'Filter', credits: 0.5 },
  { value: 'voice_clone', label: 'Voice Clone', credits: 2 },
  { value: 'voice_convert', label: 'Voice Convert', credits: 1 },
];

const statusConfig: Record<string, { icon: React.ReactNode; color: string }> = {
  queued: { icon: <Clock className="w-4 h-4" />, color: 'text-yellow-400' },
  processing: { icon: <div className="animate-spin rounded-full h-4 w-4 border-2 border-indigo-400 border-t-transparent" />, color: 'text-indigo-400' },
  completed: { icon: <CheckCircle className="w-4 h-4" />, color: 'text-green-400' },
  failed: { icon: <XCircle className="w-4 h-4" />, color: 'text-red-400' },
};

export default function BatchPage() {
  const { user } = useAuth();
  const [swapType, setSwapType] = useState('face_swap');
  const [fileIds, setFileIds] = useState('');
  const [targetId, setTargetId] = useState('');
  const [creating, setCreating] = useState(false);
  const [batchResult, setBatchResult] = useState<{ batch_id: string; jobs: BatchJob[]; credits_used: number } | null>(null);

  const selectedType = swapTypes.find(t => t.value === swapType);
  const fileCount = fileIds.split('\n').filter(f => f.trim()).length;
  const totalCost = (selectedType?.credits || 1) * fileCount;

  const createBatch = async () => {
    const ids = fileIds.split('\n').map(f => f.trim()).filter(f => f);
    if (ids.length === 0) return;
    setCreating(true);
    try {
      const res = await api.post('/api/batch/create', {
        swap_type: swapType,
        file_ids: ids,
        target_id: targetId || undefined,
      });
      setBatchResult(res.data);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to create batch');
    } finally {
      setCreating(false);
    }
  };

  const completedCount = batchResult?.jobs.filter(j => j.status === 'completed').length || 0;
  const failedCount = batchResult?.jobs.filter(j => j.status === 'failed').length || 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-3 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl">
            <Layers className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white">Batch Processing</h1>
            <p className="text-gray-400 text-sm">Process multiple files at once</p>
          </div>
        </div>

        {!batchResult ? (
          <div className="space-y-6">
            <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-6">
              <label className="block text-sm font-medium text-gray-300 mb-2">Transformation Type</label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
                {swapTypes.map(type => (
                  <button
                    key={type.value}
                    onClick={() => setSwapType(type.value)}
                    className={`p-4 rounded-xl border text-left transition-all ${
                      swapType === type.value
                        ? 'border-indigo-500 bg-indigo-500/10'
                        : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                    }`}
                  >
                    <div className="text-white font-medium">{type.label}</div>
                    <div className="text-indigo-400 text-sm mt-1">{type.credits} credits/file</div>
                  </button>
                ))}
              </div>

              <label className="block text-sm font-medium text-gray-300 mb-2">
                Source File IDs (one per line, max 20)
              </label>
              <textarea
                value={fileIds}
                onChange={(e) => setFileIds(e.target.value)}
                placeholder={"abc123\ndef456\nghi789"}
                rows={6}
                className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 font-mono text-sm mb-4"
              />

              <label className="block text-sm font-medium text-gray-300 mb-2">
                Target File ID (optional, for face swap/voice clone)
              </label>
              <input
                type="text"
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                placeholder="target file ID"
                className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 mb-4"
              />

              <div className="flex items-center justify-between p-4 bg-gray-900/50 rounded-xl mb-4">
                <div>
                  <div className="text-gray-400 text-sm">{fileCount} files selected</div>
                  <div className="text-white font-semibold">{totalCost} credits total</div>
                </div>
                <div className={`text-sm ${user && user.credits >= totalCost ? 'text-green-400' : 'text-red-400'}`}>
                  Balance: {user?.credits || 0} credits
                </div>
              </div>

              <button
                onClick={createBatch}
                disabled={fileCount === 0 || creating || (user && user.credits < totalCost)}
                className="w-full py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-500 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {creating ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                ) : (
                  <Play className="w-5 h-5" />
                )}
                Start Batch Processing
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <AlertCircle className="w-6 h-6 text-indigo-400" />
              <h2 className="text-xl font-bold text-white">Batch Created</h2>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="p-4 bg-gray-900/50 rounded-xl text-center">
                <div className="text-2xl font-bold text-white">{batchResult.jobs.length}</div>
                <div className="text-gray-400 text-sm">Total Jobs</div>
              </div>
              <div className="p-4 bg-green-500/10 rounded-xl text-center">
                <div className="text-2xl font-bold text-green-400">{completedCount}</div>
                <div className="text-gray-400 text-sm">Completed</div>
              </div>
              <div className="p-4 bg-red-500/10 rounded-xl text-center">
                <div className="text-2xl font-bold text-red-400">{failedCount}</div>
                <div className="text-gray-400 text-sm">Failed</div>
              </div>
            </div>

            <div className="space-y-2 mb-6 max-h-64 overflow-y-auto">
              {batchResult.jobs.map((job, i) => (
                <div key={job.id} className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg">
                  <span className="text-gray-500 text-sm w-6">#{i + 1}</span>
                  <span className="text-white text-sm flex-1 font-mono">{job.file_id}</span>
                  <span className={`flex items-center gap-1 text-sm ${statusConfig[job.status]?.color || 'text-gray-400'}`}>
                    {statusConfig[job.status]?.icon}
                    {job.status}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-900/50 rounded-xl mb-4">
              <span className="text-gray-400">Credits used</span>
              <span className="text-white font-semibold">{batchResult.credits_used}</span>
            </div>

            <button
              onClick={() => setBatchResult(null)}
              className="w-full py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-500 transition"
            >
              Create Another Batch
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
