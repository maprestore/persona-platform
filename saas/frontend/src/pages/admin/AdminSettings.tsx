import React, { useEffect, useState } from 'react';
import api from '../../api';

interface SettingsTab {
  id: string;
  label: string;
  icon: string;
}

const tabs: SettingsTab[] = [
  { id: 'wallet', label: 'Wallet & Payments', icon: '💼' },
  { id: 'site', label: 'Site Configuration', icon: '🌐' },
  { id: 'admin', label: 'Admin Profile', icon: '👤' },
  { id: 'api', label: 'API Keys', icon: '🔑' },
];

export default function AdminSettings() {
  const [activeTab, setActiveTab] = useState('wallet');
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  // Wallet Settings
  const [walletSettings, setWalletSettings] = useState({
    usdt_trc20_address: '',
    usdt_erc20_address: '',
    btc_address: '',
    eth_address: '',
    auto_sweep: false,
    sweep_threshold: 100,
    sweep_address: '',
    minimum_deposit: 1,
    confirmations_required: 3,
  });

  // Site Settings
  const [siteSettings, setSiteSettings] = useState({
    site_name: 'Persona Studio',
    site_description: 'AI-powered identity transformation platform',
    support_email: '',
    maintenance_mode: false,
    registration_open: true,
    max_upload_size: 100,
    default_credits: 10,
    referral_bonus: 5,
  });

  // Admin Profile
  const [adminProfile, setAdminProfile] = useState({
    username: '',
    email: '',
    current_password: '',
    new_password: '',
    wallet_address: '',
    two_factor_enabled: false,
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const res = await api.get('/api/admin/settings');
      if (res.data.wallet) setWalletSettings(res.data.wallet);
      if (res.data.site) setSiteSettings(res.data.site);
      if (res.data.admin) setAdminProfile(res.data.admin);
    } catch (err) {
      console.log('Using default settings');
    }
  };

  const handleSave = async () => {
    setLoading(true);
    setSaved(false);
    try {
      await api.put('/api/admin/settings', {
        wallet: walletSettings,
        site: siteSettings,
        admin: adminProfile,
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

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-gray-400 mt-1">Configure your platform settings</p>
      </div>

      {/* Mobile Tab Selector */}
      <div className="lg:hidden mb-6">
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-2 flex gap-2 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Desktop Tabs */}
        <div className="hidden lg:block w-64 flex-shrink-0">
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-2 space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                  activeTab === tab.id
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                <span>{tab.icon}</span>
                <span className="text-sm font-medium">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1">
          {/* Wallet & Payments Tab */}
          {activeTab === 'wallet' && (
            <div className="space-y-6">
              {/* Crypto Addresses */}
              <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
                <h2 className="text-lg font-semibold text-white mb-2">Crypto Wallet Addresses</h2>
                <p className="text-gray-400 text-sm mb-6">Configure your receiving addresses for payments</p>
                
                <div className="space-y-4">
                  <div>
                    <label className={labelClass}>USDT (TRC20)</label>
                    <input
                      type="text"
                      value={walletSettings.usdt_trc20_address}
                      onChange={(e) => setWalletSettings({...walletSettings, usdt_trc20_address: e.target.value})}
                      placeholder="TRC20 wallet address"
                      className={inputClass}
                    />
                    <p className={descClass}>Tron network USDT deposits</p>
                  </div>
                  
                  <div>
                    <label className={labelClass}>USDT (ERC20)</label>
                    <input
                      type="text"
                      value={walletSettings.usdt_erc20_address}
                      onChange={(e) => setWalletSettings({...walletSettings, usdt_erc20_address: e.target.value})}
                      placeholder="ERC20 wallet address"
                      className={inputClass}
                    />
                    <p className={descClass}>Ethereum network USDT deposits</p>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>Bitcoin (BTC)</label>
                      <input
                        type="text"
                        value={walletSettings.btc_address}
                        onChange={(e) => setWalletSettings({...walletSettings, btc_address: e.target.value})}
                        placeholder="BTC wallet address"
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Ethereum (ETH)</label>
                      <input
                        type="text"
                        value={walletSettings.eth_address}
                        onChange={(e) => setWalletSettings({...walletSettings, eth_address: e.target.value})}
                        placeholder="ETH wallet address"
                        className={inputClass}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Auto Sweep */}
              <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
                <h2 className="text-lg font-semibold text-white mb-2">Auto Sweep Settings</h2>
                <p className="text-gray-400 text-sm mb-6">Automatically transfer funds to your main wallet</p>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-800 rounded-xl">
                    <div>
                      <p className="text-white font-medium">Enable Auto Sweep</p>
                      <p className="text-sm text-gray-400">Automatically sweep funds when threshold reached</p>
                    </div>
                    <button
                      onClick={() => setWalletSettings({...walletSettings, auto_sweep: !walletSettings.auto_sweep})}
                      className={`w-12 h-6 rounded-full transition-colors ${
                        walletSettings.auto_sweep ? 'bg-indigo-600' : 'bg-gray-700'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                        walletSettings.auto_sweep ? 'translate-x-6' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </div>
                  
                  {walletSettings.auto_sweep && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className={labelClass}>Sweep Threshold (USDT)</label>
                        <input
                          type="number"
                          value={walletSettings.sweep_threshold}
                          onChange={(e) => setWalletSettings({...walletSettings, sweep_threshold: parseFloat(e.target.value)})}
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Sweep Destination Address</label>
                        <input
                          type="text"
                          value={walletSettings.sweep_address}
                          onChange={(e) => setWalletSettings({...walletSettings, sweep_address: e.target.value})}
                          placeholder="Main wallet address"
                          className={inputClass}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Deposit Settings */}
              <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
                <h2 className="text-lg font-semibold text-white mb-2">Deposit Settings</h2>
                <p className="text-gray-400 text-sm mb-6">Configure deposit requirements</p>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Minimum Deposit (USDT)</label>
                    <input
                      type="number"
                      value={walletSettings.minimum_deposit}
                      onChange={(e) => setWalletSettings({...walletSettings, minimum_deposit: parseFloat(e.target.value)})}
                      className={inputClass}
                    />
                    <p className={descClass}>Minimum amount for deposits</p>
                  </div>
                  <div>
                    <label className={labelClass}>Confirmations Required</label>
                    <input
                      type="number"
                      value={walletSettings.confirmations_required}
                      onChange={(e) => setWalletSettings({...walletSettings, confirmations_required: parseInt(e.target.value)})}
                      className={inputClass}
                    />
                    <p className={descClass}>Blockchain confirmations needed</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Site Configuration Tab */}
          {activeTab === 'site' && (
            <div className="space-y-6">
              <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
                <h2 className="text-lg font-semibold text-white mb-2">General Settings</h2>
                <p className="text-gray-400 text-sm mb-6">Basic site configuration</p>
                
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>Site Name</label>
                      <input
                        type="text"
                        value={siteSettings.site_name}
                        onChange={(e) => setSiteSettings({...siteSettings, site_name: e.target.value})}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Support Email</label>
                      <input
                        type="email"
                        value={siteSettings.support_email}
                        onChange={(e) => setSiteSettings({...siteSettings, support_email: e.target.value})}
                        placeholder="support@example.com"
                        className={inputClass}
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className={labelClass}>Site Description</label>
                    <textarea
                      value={siteSettings.site_description}
                      onChange={(e) => setSiteSettings({...siteSettings, site_description: e.target.value})}
                      rows={3}
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>

              {/* Toggles */}
              <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
                <h2 className="text-lg font-semibold text-white mb-2">Feature Toggles</h2>
                <p className="text-gray-400 text-sm mb-6">Enable or disable platform features</p>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-4 bg-gray-800 rounded-xl">
                    <div>
                      <p className="text-white font-medium">Maintenance Mode</p>
                      <p className="text-sm text-gray-400">Temporarily disable public access</p>
                    </div>
                    <button
                      onClick={() => setSiteSettings({...siteSettings, maintenance_mode: !siteSettings.maintenance_mode})}
                      className={`w-12 h-6 rounded-full transition-colors ${
                        siteSettings.maintenance_mode ? 'bg-yellow-500' : 'bg-gray-700'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                        siteSettings.maintenance_mode ? 'translate-x-6' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </div>
                  
                  <div className="flex items-center justify-between p-4 bg-gray-800 rounded-xl">
                    <div>
                      <p className="text-white font-medium">Open Registration</p>
                      <p className="text-sm text-gray-400">Allow new user signups</p>
                    </div>
                    <button
                      onClick={() => setSiteSettings({...siteSettings, registration_open: !siteSettings.registration_open})}
                      className={`w-12 h-6 rounded-full transition-colors ${
                        siteSettings.registration_open ? 'bg-green-500' : 'bg-gray-700'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                        siteSettings.registration_open ? 'translate-x-6' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Credits Settings */}
              <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
                <h2 className="text-lg font-semibold text-white mb-2">Credit Settings</h2>
                <p className="text-gray-400 text-sm mb-6">Configure credit allocations</p>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className={labelClass}>Default Credits</label>
                    <input
                      type="number"
                      value={siteSettings.default_credits}
                      onChange={(e) => setSiteSettings({...siteSettings, default_credits: parseInt(e.target.value)})}
                      className={inputClass}
                    />
                    <p className={descClass}>Credits for new users</p>
                  </div>
                  <div>
                    <label className={labelClass}>Referral Bonus</label>
                    <input
                      type="number"
                      value={siteSettings.referral_bonus}
                      onChange={(e) => setSiteSettings({...siteSettings, referral_bonus: parseInt(e.target.value)})}
                      className={inputClass}
                    />
                    <p className={descClass}>Credits per referral</p>
                  </div>
                  <div>
                    <label className={labelClass}>Max Upload (MB)</label>
                    <input
                      type="number"
                      value={siteSettings.max_upload_size}
                      onChange={(e) => setSiteSettings({...siteSettings, max_upload_size: parseInt(e.target.value)})}
                      className={inputClass}
                    />
                    <p className={descClass}>Maximum file size</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Admin Profile Tab */}
          {activeTab === 'admin' && (
            <div className="space-y-6">
              <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
                <h2 className="text-lg font-semibold text-white mb-2">Profile Information</h2>
                <p className="text-gray-400 text-sm mb-6">Update your admin profile</p>
                
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>Username</label>
                      <input
                        type="text"
                        value={adminProfile.username}
                        onChange={(e) => setAdminProfile({...adminProfile, username: e.target.value})}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Email</label>
                      <input
                        type="email"
                        value={adminProfile.email}
                        onChange={(e) => setAdminProfile({...adminProfile, email: e.target.value})}
                        className={inputClass}
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className={labelClass}>Personal Wallet Address</label>
                    <input
                      type="text"
                      value={adminProfile.wallet_address}
                      onChange={(e) => setAdminProfile({...adminProfile, wallet_address: e.target.value})}
                      placeholder="Your personal crypto wallet"
                      className={inputClass}
                    />
                    <p className={descClass}>For receiving payments and withdrawals</p>
                  </div>
                </div>
              </div>

              <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
                <h2 className="text-lg font-semibold text-white mb-2">Change Password</h2>
                <p className="text-gray-400 text-sm mb-6">Update your admin password</p>
                
                <div className="space-y-4">
                  <div>
                    <label className={labelClass}>Current Password</label>
                    <input
                      type="password"
                      value={adminProfile.current_password}
                      onChange={(e) => setAdminProfile({...adminProfile, current_password: e.target.value})}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>New Password</label>
                    <input
                      type="password"
                      value={adminProfile.new_password}
                      onChange={(e) => setAdminProfile({...adminProfile, new_password: e.target.value})}
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>

              <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
                <h2 className="text-lg font-semibold text-white mb-2">Security</h2>
                <p className="text-gray-400 text-sm mb-6">Enhance your account security</p>
                
                <div className="flex items-center justify-between p-4 bg-gray-800 rounded-xl">
                  <div>
                    <p className="text-white font-medium">Two-Factor Authentication</p>
                    <p className="text-sm text-gray-400">Add extra security to your account</p>
                  </div>
                  <button
                    onClick={() => setAdminProfile({...adminProfile, two_factor_enabled: !adminProfile.two_factor_enabled})}
                    className={`w-12 h-6 rounded-full transition-colors ${
                      adminProfile.two_factor_enabled ? 'bg-green-500' : 'bg-gray-700'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                      adminProfile.two_factor_enabled ? 'translate-x-6' : 'translate-x-0.5'
                    }`} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* API Keys Tab */}
          {activeTab === 'api' && (
            <div className="space-y-6">
              <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
                <h2 className="text-lg font-semibold text-white mb-2">API Configuration</h2>
                <p className="text-gray-400 text-sm mb-6">Manage API access keys</p>
                
                <div className="space-y-4">
                  <div>
                    <label className={labelClass}>Engine API Key</label>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        value="sk-xxxxxxxxxxxxxxxxxxxx"
                        readOnly
                        className={inputClass}
                      />
                      <button className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-xl text-white transition-colors">
                        Regenerate
                      </button>
                    </div>
                    <p className={descClass}>Used to authenticate with the persona engine</p>
                  </div>
                  
                  <div>
                    <label className={labelClass}>Webhook Secret</label>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        value="whsec_xxxxxxxxxxxxxxxxxxxx"
                        readOnly
                        className={inputClass}
                      />
                      <button className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-xl text-white transition-colors">
                        Regenerate
                      </button>
                    </div>
                    <p className={descClass}>For payment webhook verification</p>
                  </div>
                </div>
              </div>

              <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
                <h2 className="text-lg font-semibold text-white mb-2">Rate Limiting</h2>
                <p className="text-gray-400 text-sm mb-6">Control API usage limits</p>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className={labelClass}>Requests/min (Public)</label>
                    <input type="number" defaultValue={60} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Requests/min (Authenticated)</label>
                    <input type="number" defaultValue={120} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Requests/min (Admin)</label>
                    <input type="number" defaultValue={300} className={inputClass} />
                  </div>
                </div>
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
              {loading ? 'Saving...' : 'Save All Settings'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
