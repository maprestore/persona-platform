import React, { useEffect, useState } from 'react';
import api from '../../api';

interface VastInstance {
  id: number;
  label: string;
  gpu_name: string;
  gpu_ram: number;
  num_gpus: number;
  dph_total: number;
  hours: number;
  total_cost: number;
  status: string;
  ssh_host: string;
  ssh_port: number;
  image: string;
  disk_space: number;
  cpu_ram: number;
  created_at: string;
}

interface VastOffer {
  id: number;
  gpu_name: string;
  gpu_ram: number;
  num_gpus: number;
  dph_total: number;
  reliability: number;
  uptime_fraction: number;
  verified: boolean;
  inet_up: number;
  inet_down: number;
  host_name: string;
  geolocation: string;
}

const gpuOptions = [
  { name: 'RTX 3090', vram: 24, minDph: 0.06, avgDph: 0.15 },
  { name: 'RTX 4090', vram: 24, minDph: 0.10, avgDph: 0.35 },
  { name: 'A100 40GB', vram: 40, minDph: 0.29, avgDph: 2.00 },
  { name: 'A100 80GB', vram: 80, minDph: 0.20, avgDph: 2.50 },
  { name: 'H100 PCIe', vram: 80, minDph: 0.87, avgDph: 2.20 },
  { name: 'L4', vram: 24, minDph: 0.12, avgDph: 0.20 },
];

const statusColors: Record<string, string> = {
  running: 'bg-green-500/20 text-green-400',
  loading: 'bg-yellow-500/20 text-yellow-400',
  stopped: 'bg-gray-500/20 text-gray-400',
  exited: 'bg-red-500/20 text-red-400',
  unknown: 'bg-red-500/20 text-red-400',
  offline: 'bg-red-500/20 text-red-400',
};

export default function AdminVastGPU() {
  const [tab, setTab] = useState<'instances' | 'deploy' | 'config'>('instances');
  const [instances, setInstances] = useState<VastInstance[]>([]);
  const [offers, setOffers] = useState<VastOffer[]>([]);
  const [costs, setCosts] = useState<any>(null);
  const [config, setConfig] = useState({
    api_key: '',
    auto_scale: true,
    max_instances: 3,
    gpu_preference: 'RTX 4090',
    max_dph: 1.0,
    engine_image: 'personastudio/engine:latest',
  });
  const [loading, setLoading] = useState(true);
  const [deploying, setDeploying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  // Deploy form
  const [deployGpu, setDeployGpu] = useState('RTX 4090');
  const [deployGpus, setDeployGpus] = useState(1);
  const [deployMaxPrice, setDeployMaxPrice] = useState(1.0);
  const [deployLabel, setDeployLabel] = useState('persona-engine');

  useEffect(() => {
    loadConfig();
    loadInstances();
    loadCosts();
  }, []);

  const loadConfig = async () => {
    try {
      const res = await api.get('/api/admin/vast/config');
      setConfig({
        api_key: '',
        auto_scale: res.data.auto_scale,
        max_instances: res.data.max_instances,
        gpu_preference: res.data.gpu_preference,
        max_dph: res.data.max_dph,
        engine_image: res.data.engine_image,
      });
    } catch {}
  };

  const loadInstances = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/admin/vast/instances');
      setInstances(res.data.instances);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load instances');
    } finally {
      setLoading(false);
    }
  };

  const loadCosts = async () => {
    try {
      const res = await api.get('/api/admin/vast/costs');
      setCosts(res.data);
    } catch {}
  };

  const handleSaveConfig = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await api.put('/api/admin/vast/config', config);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleSearchOffers = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/api/admin/vast/offers?gpu_name=${deployGpu}&num_gpus=${deployGpus}&max_price=${deployMaxPrice}`);
      setOffers(res.data.offers);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to search offers');
    } finally {
      setLoading(false);
    }
  };

  const handleDeploy = async (offerId?: number) => {
    setDeploying(true);
    try {
      const res = await api.post('/api/admin/vast/deploy', {
        gpu_name: deployGpu,
        num_gpus: deployGpus,
        max_price: deployMaxPrice,
        image: config.engine_image,
        label: deployLabel,
      });
      alert(res.data.message);
      loadInstances();
      setTab('instances');
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Deploy failed');
    } finally {
      setDeploying(false);
    }
  };

  const handleStart = async (id: number) => {
    try {
      await api.post(`/api/admin/vast/instances/${id}/start`);
      loadInstances();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to start');
    }
  };

  const handleStop = async (id: number) => {
    try {
      await api.post(`/api/admin/vast/instances/${id}/stop`);
      loadInstances();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to stop');
    }
  };

  const handleDestroy = async (id: number) => {
    if (!confirm(`Destroy instance ${id}? This cannot be undone.`)) return;
    try {
      await api.delete(`/api/admin/vast/instances/${id}`);
      loadInstances();
      loadCosts();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to destroy');
    }
  };

  const inputClass = "w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all";
  const labelClass = "block text-sm font-medium text-gray-300 mb-2";

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">GPU Management</h1>
          <p className="text-gray-400 mt-1">Deploy and manage Vast.ai GPU instances</p>
        </div>
        {costs && (
          <div className="flex gap-4">
            <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-2 text-center">
              <p className="text-xs text-gray-400">Active GPUs</p>
              <p className="text-xl font-bold text-white">{costs.instance_count}</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-2 text-center">
              <p className="text-xs text-gray-400">Hourly Cost</p>
              <p className="text-xl font-bold text-indigo-400">${costs.total_dph.toFixed(2)}</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-2 text-center">
              <p className="text-xs text-gray-400">Total Spent</p>
              <p className="text-xl font-bold text-red-400">${costs.total_cost.toFixed(2)}</p>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {[
          { id: 'instances' as const, label: 'Instances', icon: '🖥️' },
          { id: 'deploy' as const, label: 'Deploy New', icon: '🚀' },
          { id: 'config' as const, label: 'Configuration', icon: '⚙️' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 ${
              tab === t.id ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            <span>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* Instances Tab */}
      {tab === 'instances' && (
        <div>
          {loading ? (
            <div className="text-center py-12 text-gray-400">Loading instances...</div>
          ) : instances.length === 0 ? (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
              <span className="text-5xl block mb-4">🖥️</span>
              <p className="text-gray-400 text-lg mb-2">No GPU instances running</p>
              <p className="text-gray-500 text-sm mb-4">Deploy your first instance to get started</p>
              <button onClick={() => setTab('deploy')} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-colors">
                Deploy Instance
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {instances.map((inst) => (
                <div key={inst.id} className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center">
                        <span className="text-xl">🖥️</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-white font-semibold">{inst.label || `Instance ${inst.id}`}</h3>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[inst.status] || 'bg-gray-500/20 text-gray-400'}`}>
                            {inst.status}
                          </span>
                        </div>
                        <p className="text-gray-400 text-sm">
                          {inst.gpu_name} • {inst.gpu_ram}GB VRAM • ${inst.dph_total.toFixed(2)}/hr
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-white font-medium">{inst.hours.toFixed(1)}h</p>
                        <p className="text-red-400 text-sm">${inst.total_cost.toFixed(2)}</p>
                      </div>
                      <div className="flex gap-2">
                        {inst.status === 'stopped' && (
                          <button onClick={() => handleStart(inst.id)} className="px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-sm rounded-lg transition-colors">
                            ▶ Start
                          </button>
                        )}
                        {inst.status === 'running' && (
                          <button onClick={() => handleStop(inst.id)} className="px-3 py-1.5 bg-yellow-600 hover:bg-yellow-500 text-white text-sm rounded-lg transition-colors">
                            ⏸ Stop
                          </button>
                        )}
                        <button onClick={() => handleDestroy(inst.id)} className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600/40 text-red-400 text-sm rounded-lg transition-colors">
                          🗑 Destroy
                        </button>
                      </div>
                    </div>
                  </div>
                  {inst.ssh_host && inst.status === 'running' && (
                    <div className="mt-4 p-3 bg-gray-800 rounded-lg">
                      <p className="text-xs text-gray-500 mb-1">SSH Access</p>
                      <code className="text-sm text-indigo-400">ssh root@{inst.ssh_host} -p {inst.ssh_port}</code>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          <button onClick={loadInstances} className="mt-4 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-xl transition-colors text-sm">
            🔄 Refresh
          </button>
        </div>
      )}

      {/* Deploy Tab */}
      {tab === 'deploy' && (
        <div className="space-y-6">
          {/* GPU Selection */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Select GPU Type</h2>
            <div className="grid md:grid-cols-3 gap-4 mb-6">
              {gpuOptions.map((gpu) => (
                <button
                  key={gpu.name}
                  onClick={() => setDeployGpu(gpu.name)}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    deployGpu === gpu.name
                      ? 'bg-gradient-to-br from-indigo-600/20 to-purple-600/20 border-indigo-500'
                      : 'bg-gray-800 border-gray-700 hover:border-gray-600'
                  }`}
                >
                  <p className="text-white font-semibold">{gpu.name}</p>
                  <p className="text-gray-400 text-sm">{gpu.vram}GB VRAM</p>
                  <p className="text-indigo-400 text-sm mt-1">${gpu.minDph} - ${gpu.avgDph}/hr</p>
                </button>
              ))}
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>Number of GPUs</label>
                <select value={deployGpus} onChange={(e) => setDeployGpus(Number(e.target.value))} className={inputClass}>
                  <option value={1}>1 GPU</option>
                  <option value={2}>2 GPUs</option>
                  <option value={4}>4 GPUs</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Max Price ($/hr)</label>
                <input type="number" step="0.05" value={deployMaxPrice} onChange={(e) => setDeployMaxPrice(Number(e.target.value))} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Instance Label</label>
                <input type="text" value={deployLabel} onChange={(e) => setDeployLabel(e.target.value)} className={inputClass} />
              </div>
            </div>
          </div>

          {/* Quick Deploy */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Quick Deploy</h2>
            <p className="text-gray-400 text-sm mb-4">
              Automatically find the cheapest {deployGpu} instance and deploy your engine.
            </p>
            <button
              onClick={() => handleDeploy()}
              disabled={deploying}
              className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-medium rounded-xl transition-all disabled:opacity-50"
            >
              {deploying ? 'Deploying...' : `🚀 Deploy ${deployGpu} Instance`}
            </button>
          </div>

          {/* Browse Offers */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Browse Available Offers</h2>
              <button onClick={handleSearchOffers} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm">
                🔍 Search Offers
              </button>
            </div>
            {offers.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="py-3 px-3 text-xs font-semibold text-gray-400 uppercase">GPU</th>
                      <th className="py-3 px-3 text-xs font-semibold text-gray-400 uppercase">VRAM</th>
                      <th className="py-3 px-3 text-xs font-semibold text-gray-400 uppercase">Price/hr</th>
                      <th className="py-3 px-3 text-xs font-semibold text-gray-400 uppercase">Reliability</th>
                      <th className="py-3 px-3 text-xs font-semibold text-gray-400 uppercase">Location</th>
                      <th className="py-3 px-3 text-xs font-semibold text-gray-400 uppercase">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {offers.map((offer) => (
                      <tr key={offer.id} className="border-b border-gray-800 hover:bg-gray-800/30">
                        <td className="py-3 px-3 text-white text-sm">{offer.gpu_name}</td>
                        <td className="py-3 px-3 text-gray-300 text-sm">{offer.gpu_ram}GB</td>
                        <td className="py-3 px-3 text-indigo-400 text-sm font-medium">${offer.dph_total.toFixed(3)}</td>
                        <td className="py-3 px-3 text-sm">
                          <span className={`px-2 py-0.5 rounded text-xs ${
                            offer.reliability > 0.95 ? 'bg-green-500/20 text-green-400' :
                            offer.reliability > 0.85 ? 'bg-yellow-500/20 text-yellow-400' :
                            'bg-red-500/20 text-red-400'
                          }`}>
                            {(offer.reliability * 100).toFixed(1)}%
                          </span>
                        </td>
                        <td className="py-3 px-3 text-gray-400 text-sm">{offer.geolocation}</td>
                        <td className="py-3 px-3">
                          <button
                            onClick={() => handleDeploy(offer.id)}
                            className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs rounded-lg transition-colors"
                          >
                            Deploy
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Config Tab */}
      {tab === 'config' && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Vast.ai Configuration</h2>
          {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

          <div className="space-y-4">
            <div>
              <label className={labelClass}>API Key</label>
              <input
                type="password"
                value={config.api_key}
                onChange={(e) => setConfig({...config, api_key: e.target.value})}
                placeholder="Enter your Vast.ai API key"
                className={inputClass}
              />
              <p className="text-xs text-gray-500 mt-1">
                Get your API key from <a href="https://cloud.vast.ai/manage-keys/" target="_blank" rel="noopener" className="text-indigo-400 hover:underline">cloud.vast.ai/manage-keys</a>
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Default GPU Type</label>
                <select value={config.gpu_preference} onChange={(e) => setConfig({...config, gpu_preference: e.target.value})} className={inputClass}>
                  {gpuOptions.map((g) => <option key={g.name} value={g.name}>{g.name} ({g.vram}GB)</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Max $/hr per Instance</label>
                <input type="number" step="0.10" value={config.max_dph} onChange={(e) => setConfig({...config, max_dph: Number(e.target.value)})} className={inputClass} />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Max Instances</label>
                <input type="number" min={1} max={10} value={config.max_instances} onChange={(e) => setConfig({...config, max_instances: Number(e.target.value)})} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Engine Docker Image</label>
                <input type="text" value={config.engine_image} onChange={(e) => setConfig({...config, engine_image: e.target.value})} className={inputClass} />
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-800 rounded-xl">
              <div>
                <p className="text-white font-medium">Auto-Scaling</p>
                <p className="text-sm text-gray-400">Automatically start/stop GPUs based on demand</p>
              </div>
              <button
                onClick={() => setConfig({...config, auto_scale: !config.auto_scale})}
                className={`w-12 h-6 rounded-full transition-colors ${config.auto_scale ? 'bg-green-500' : 'bg-gray-700'}`}
              >
                <div className={`w-5 h-5 rounded-full bg-white transition-transform ${config.auto_scale ? 'translate-x-6' : 'translate-x-0.5'}`} />
              </button>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-end gap-4">
            {saved && <span className="text-green-400 text-sm">✓ Saved</span>}
            <button onClick={handleSaveConfig} disabled={saving} className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-medium rounded-xl transition-all disabled:opacity-50">
              {saving ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
