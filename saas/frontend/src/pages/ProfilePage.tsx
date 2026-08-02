import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../api';
import { User, Lock, Bell, Webhook, Shield, Save, Trash2, Plus } from 'lucide-react';

interface Webhook {
  id: string;
  url: string;
  events: string[];
  active: boolean;
}

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [notifications, setNotifications] = useState({
    email_completed: true,
    email_failed: true,
    email_credits: true,
    email_announcements: true,
  });
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    loadWebhooks();
  }, []);

  useEffect(() => {
    if (user) {
      setUsername(user.username || '');
      setEmail(user.email || '');
    }
  }, [user]);

  const loadWebhooks = async () => {
    try {
      const res = await api.get('/api/user/webhooks');
      setWebhooks(res.data.webhooks);
    } catch {}
  };

  const saveProfile = async () => {
    setSaving(true);
    setMessage({ type: '', text: '' });
    try {
      await api.put('/api/user/profile', { username, email });
      setMessage({ type: 'success', text: 'Profile updated!' });
      await refreshUser();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.detail || 'Failed to update' });
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async () => {
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match' });
      return;
    }
    setSaving(true);
    setMessage({ type: '', text: '' });
    try {
      await api.post('/api/user/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      });
      setMessage({ type: 'success', text: 'Password changed!' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.detail || 'Failed to change password' });
    } finally {
      setSaving(false);
    }
  };

  const saveNotifications = async () => {
    setSaving(true);
    try {
      await api.put('/api/user/notifications', notifications);
      setMessage({ type: 'success', text: 'Notification preferences saved!' });
    } catch {
      setMessage({ type: 'error', text: 'Failed to save preferences' });
    } finally {
      setSaving(false);
    }
  };

  const addWebhook = async () => {
    if (!webhookUrl) return;
    try {
      const res = await api.post('/api/user/webhooks', { url: webhookUrl });
      setWebhooks([...webhooks, { id: res.data.webhook_id, url: webhookUrl, events: res.data.events, active: true }]);
      setWebhookUrl('');
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to add webhook');
    }
  };

  const deleteWebhook = async (id: string) => {
    try {
      await api.delete(`/api/user/webhooks/${id}`);
      setWebhooks(webhooks.filter(w => w.id !== id));
    } catch {}
  };

  const tabs = [
    { id: 'profile', label: 'Profile', icon: <User className="w-4 h-4" /> },
    { id: 'security', label: 'Security', icon: <Lock className="w-4 h-4" /> },
    { id: 'notifications', label: 'Notifications', icon: <Bell className="w-4 h-4" /> },
    { id: 'webhooks', label: 'Webhooks', icon: <Webhook className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-3 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl">
            <User className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white">Profile & Settings</h1>
            <p className="text-gray-400 text-sm">Manage your account</p>
          </div>
        </div>

        {message.text && (
          <div className={`mb-6 p-4 rounded-xl ${
            message.type === 'success' ? 'bg-green-500/10 border border-green-500/20 text-green-400' :
            'bg-red-500/10 border border-red-500/20 text-red-400'
          }`}>
            {message.text}
          </div>
        )}

        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-800/50 text-gray-400 hover:text-white'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-6">
          {activeTab === 'profile' && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-white mb-4">Profile Information</h2>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div className="p-4 bg-gray-900/50 rounded-lg">
                <div className="text-sm text-gray-400">Credits Balance</div>
                <div className="text-2xl font-bold text-indigo-400">{user?.credits || 0}</div>
              </div>
              <button
                onClick={saveProfile}
                disabled={saving}
                className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition disabled:opacity-50 flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Change Password
              </h2>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Current Password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <button
                onClick={changePassword}
                disabled={saving || !currentPassword || !newPassword}
                className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition disabled:opacity-50 flex items-center gap-2"
              >
                <Lock className="w-4 h-4" />
                {saving ? 'Changing...' : 'Change Password'}
              </button>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-white mb-4">Notification Preferences</h2>
              {Object.entries({
                email_completed: 'Email when swap completes',
                email_failed: 'Email when swap fails',
                email_credits: 'Email on credit changes',
                email_announcements: 'Email announcements',
              }).map(([key, label]) => (
                <label key={key} className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg cursor-pointer">
                  <span className="text-white">{label}</span>
                  <input
                    type="checkbox"
                    checked={notifications[key as keyof typeof notifications]}
                    onChange={(e) => setNotifications({ ...notifications, [key]: e.target.checked })}
                    className="w-5 h-5 rounded border-gray-600 bg-gray-800 text-indigo-500 focus:ring-indigo-500"
                  />
                </label>
              ))}
              <button
                onClick={saveNotifications}
                disabled={saving}
                className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition disabled:opacity-50 flex items-center gap-2"
              >
                <Bell className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save Preferences'}
              </button>
            </div>
          )}

          {activeTab === 'webhooks' && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Webhook className="w-5 h-5" />
                Webhooks
              </h2>
              <p className="text-gray-400 text-sm mb-4">Get notified when jobs complete via HTTP callbacks</p>

              <div className="flex gap-2">
                <input
                  type="url"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://your-app.com/webhook"
                  className="flex-1 px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                />
                <button
                  onClick={addWebhook}
                  disabled={!webhookUrl}
                  className="px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition disabled:opacity-50 flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add
                </button>
              </div>

              <div className="space-y-2">
                {webhooks.map(webhook => (
                  <div key={webhook.id} className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg">
                    <div className="flex-1">
                      <div className="text-white text-sm font-mono truncate">{webhook.url}</div>
                      <div className="text-gray-500 text-xs">{webhook.events.join(', ')}</div>
                    </div>
                    <button
                      onClick={() => deleteWebhook(webhook.id)}
                      className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {webhooks.length === 0 && (
                  <div className="text-gray-500 text-center py-8">No webhooks configured</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
