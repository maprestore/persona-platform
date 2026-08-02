import React, { useEffect, useState } from 'react';
import api from '../../api';

export default function AdminSystem() {
  const [activeSection, setActiveSection] = useState('engine');
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [engineStatus, setEngineStatus] = useState<any>(null);

  // Engine Settings
  const [engineSettings, setEngineSettings] = useState({
    engine_url: 'http://localhost:6967',
    timeout: 120,
    max_upload: 100,
  });

  // SMTP Settings
  const [smtpSettings, setSmtpSettings] = useState({
    host: '',
    port: 587,
    user: '',
    pass: '',
  });

  // Rate Limiting
  const [rateLimits, setRateLimits] = useState({
    requests_per_minute: 60,
    swaps_per_hour: 100,
  });

  // Cache Settings
  const [cacheSettings, setCacheSettings] = useState({
    ttl: 300,
    max_size: 1000,
  });

  // Backup Settings
  const [backupSettings, setBackupSettings] = useState({
    enabled: true,
    interval: 'daily',
  });

  useEffect(() => {
    loadSettings();
    checkEngineStatus();
  }, []);

  const loadSettings = async () => {
    try {
      const res = await api.get('/api/admin/system');
      if (res.data.engine) {
        setEngineSettings({
          engine_url: res.data.engine.url || 'http://localhost:6967',
          timeout: res.data.engine.timeout || 120,
          max_upload: res.data.engine.max_upload || 100,
        });
      }
      if (res.data.smtp) {
        setSmtpSettings({
          host: res.data.smtp.host || '',
          port: res.data.smtp.port || 587,
          user: res.data.smtp.user || '',
          pass: res.data.smtp.pass || '',
        });
      }
      if (res.data.rate_limits) {
        setRateLimits({
          requests_per_minute: res.data.rate_limits.requests_per_minute || 60,
          swaps_per_hour: res.data.rate_limits.swaps_per_hour || 100,
        });
      }
      if (res.data.cache) {
        setCacheSettings({
          ttl: res.data.cache.ttl || 300,
          max_size: res.data.cache.max_size || 1000,
        });
      }
      if (res.data.backup) {
        setBackupSettings({
          enabled: res.data.backup.enabled ?? true,
          interval: res.data.backup.interval || 'daily',
        });
      }
    } catch (err) {
      console.log('Using default settings');
    }
  };

  const checkEngineStatus = async () => {
    try {
      const res = await api.get('/api/admin/engine/status');
      setEngineStatus(res.data);
    } catch (err) {
      setEngineStatus({ status: 'offline' });
    }
  };

  const handleSave = async () => {
    setLoading(true);
    setSaved(false);
    try {
      await api.put('/api/admin/system', {
        engine: engineSettings,
        smtp: smtpSettings,
        rate_limits: rateLimits,
        cache: cacheSettings,
        backup: backupSettings,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all";
  const labelClass = "block text-sm font-medium text-gray-300 mb-2";
  const descClass = "text-xs text-gray-500 mt-1";

  const sections = [
    { id: 'engine', label: 'AI Engine', icon: '🤖' },
    { id: 'smtp', label: 'Email (SMTP)', icon: '📧' },
    { id: 'rate', label: 'Rate Limiting', icon: '🚦' },
    { id: 'cache', label: 'Cache', icon: '💾' },
    { id: 'backup', label: 'Backups', icon: '📦' },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Mobile Tab Selector */}
      <div className="lg:hidden mb-6">
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-2 flex gap-2 overflow-x-auto">
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                activeSection === section.id
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              <span>{section.icon}</span>
              <span>{section.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">System Configuration</h1>
          <p className="text-gray-400 mt-1">Configure engine, email, and system settings</p>
        </div>
        
        {/* Engine Status Badge */}
        <div className={`flex items-center gap-2 px-4 py-2 rounded-xl w-fit ${
          engineStatus?.status === 'online' 
            ? 'bg-green-500/20 border border-green-500/30' 
            : 'bg-red-500/20 border border-red-500/30'
        }`}>
          <div className={`w-2 h-2 rounded-full ${
            engineStatus?.status === 'online' ? 'bg-green-500 animate-pulse' : 'bg-red-500'
          }`} />
          <span className={`text-sm font-medium ${
            engineStatus?.status === 'online' ? 'text-green-400' : 'text-red-400'
          }`}>
            Engine {engineStatus?.status === 'online' ? 'Online' : 'Offline'}
          </span>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Desktop Sidebar */}
        <div className="hidden lg:block w-56 flex-shrink-0">
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-2 space-y-1">
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                  activeSection === section.id
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                <span>{section.icon}</span>
                <span className="text-sm font-medium">{section.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1">
          {/* AI Engine Section */}
          {activeSection === 'engine' && (
            <div className="space-y-6">
              <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
                <h2 className="text-lg font-semibold text-white mb-2">AI Engine Configuration</h2>
                <p className="text-gray-400 text-sm mb-6">Configure the face swap and AI processing engine</p>
                
                <div className="space-y-4">
                  <div>
                    <label className={labelClass}>Engine URL</label>
                    <input
                      type="text"
                      value={engineSettings.engine_url}
                      onChange={(e) => setEngineSettings({...engineSettings, engine_url: e.target.value})}
                      className={inputClass}
                    />
                    <p className={descClass}>URL of the Persona Engine API</p>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>Timeout (seconds)</label>
                      <input
                        type="number"
                        value={engineSettings.timeout}
                        onChange={(e) => setEngineSettings({...engineSettings, timeout: parseInt(e.target.value)})}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Max Upload (MB)</label>
                      <input
                        type="number"
                        value={engineSettings.max_upload}
                        onChange={(e) => setEngineSettings({...engineSettings, max_upload: parseInt(e.target.value)})}
                        className={inputClass}
                      />
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Engine Actions */}
              <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
                <h2 className="text-lg font-semibold text-white mb-4">Engine Actions</h2>
                <div className="flex gap-3">
                  <button className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors">
                    ▶️ Start Engine
                  </button>
                  <button className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 text-white rounded-lg transition-colors">
                    🔄 Restart Engine
                  </button>
                  <button className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors">
                    ⏹️ Stop Engine
                  </button>
                  <button 
                    onClick={checkEngineStatus}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                  >
                    🔍 Check Status
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* SMTP Section */}
          {activeSection === 'smtp' && (
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
              <h2 className="text-lg font-semibold text-white mb-2">Email Configuration</h2>
              <p className="text-gray-400 text-sm mb-6">Configure SMTP for transactional emails</p>
              
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>SMTP Host</label>
                    <input
                      type="text"
                      value={smtpSettings.host}
                      onChange={(e) => setSmtpSettings({...smtpSettings, host: e.target.value})}
                      placeholder="smtp.gmail.com"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Port</label>
                    <input
                      type="number"
                      value={smtpSettings.port}
                      onChange={(e) => setSmtpSettings({...smtpSettings, port: parseInt(e.target.value)})}
                      className={inputClass}
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Username</label>
                    <input
                      type="text"
                      value={smtpSettings.user}
                      onChange={(e) => setSmtpSettings({...smtpSettings, user: e.target.value})}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Password</label>
                    <input
                      type="password"
                      value={smtpSettings.pass}
                      onChange={(e) => setSmtpSettings({...smtpSettings, pass: e.target.value})}
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Rate Limiting Section */}
          {activeSection === 'rate' && (
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
              <h2 className="text-lg font-semibold text-white mb-2">Rate Limiting</h2>
              <p className="text-gray-400 text-sm mb-6">Protect your API from abuse</p>
              
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Requests per Minute</label>
                    <input
                      type="number"
                      value={rateLimits.requests_per_minute}
                      onChange={(e) => setRateLimits({...rateLimits, requests_per_minute: parseInt(e.target.value)})}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Swaps per Hour</label>
                    <input
                      type="number"
                      value={rateLimits.swaps_per_hour}
                      onChange={(e) => setRateLimits({...rateLimits, swaps_per_hour: parseInt(e.target.value)})}
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Cache Section */}
          {activeSection === 'cache' && (
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
              <h2 className="text-lg font-semibold text-white mb-2">Cache Configuration</h2>
              <p className="text-gray-400 text-sm mb-6">Optimize performance with caching</p>
              
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>TTL (seconds)</label>
                    <input
                      type="number"
                      value={cacheSettings.ttl}
                      onChange={(e) => setCacheSettings({...cacheSettings, ttl: parseInt(e.target.value)})}
                      className={inputClass}
                    />
                    <p className={descClass}>Cache expiration time</p>
                  </div>
                  <div>
                    <label className={labelClass}>Max Size (items)</label>
                    <input
                      type="number"
                      value={cacheSettings.max_size}
                      onChange={(e) => setCacheSettings({...cacheSettings, max_size: parseInt(e.target.value)})}
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Backup Section */}
          {activeSection === 'backup' && (
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
              <h2 className="text-lg font-semibold text-white mb-2">Backup Configuration</h2>
              <p className="text-gray-400 text-sm mb-6">Automated database backups</p>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-800 rounded-xl">
                  <div>
                    <p className="text-white font-medium">Auto Backup</p>
                    <p className="text-sm text-gray-400">Automatically backup database</p>
                  </div>
                  <button
                    onClick={() => setBackupSettings({...backupSettings, enabled: !backupSettings.enabled})}
                    className={`w-12 h-6 rounded-full transition-colors ${
                      backupSettings.enabled ? 'bg-green-500' : 'bg-gray-700'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                      backupSettings.enabled ? 'translate-x-6' : 'translate-x-0.5'
                    }`} />
                  </button>
                </div>
                
                {backupSettings.enabled && (
                  <div>
                    <label className={labelClass}>Backup Interval</label>
                    <select
                      value={backupSettings.interval}
                      onChange={(e) => setBackupSettings({...backupSettings, interval: e.target.value})}
                      className={inputClass}
                    >
                      <option value="hourly">Hourly</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                    </select>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Save Button */}
          <div className="mt-6 flex items-center justify-end gap-4">
            {saved && (
              <span className="text-green-400 text-sm flex items-center gap-2">
                <span>✓</span> Settings saved successfully
              </span>
            )}
            <button
              onClick={handleSave}
              disabled={loading}
              className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-medium rounded-xl transition-all shadow-lg shadow-indigo-500/25 disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
