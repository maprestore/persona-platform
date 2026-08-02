import React, { useEffect, useState } from 'react';
import api from '../../api';

export default function AdminPricing() {
  const [pricing, setPricing] = useState<any[]>([]);
  const [packages, setPackages] = useState<any[]>([]);
  const [editing, setEditing] = useState<any>(null);
  const [cost, setCost] = useState('');

  useEffect(() => {
    api.get('/api/pricing').then(res => setPricing(res.data.pricing));
    api.get('/api/credits/packages').then(res => setPackages(res.data.packages));
  }, []);

  const handleUpdate = async () => {
    if (!editing || !cost) return;
    await api.put('/api/admin/pricing', {
      feature: editing.feature,
      credits_cost: parseFloat(cost),
    });
    setEditing(null);
    setCost('');
    api.get('/api/pricing').then(res => setPricing(res.data.pricing));
  };

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Pricing Management</h1>
        <p className="text-gray-400 mt-1">Manage credit costs and packages</p>
      </div>

      {/* Feature Pricing */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden mb-6">
        <div className="p-4 border-b border-gray-800">
          <h2 className="text-lg font-semibold text-white">Feature Pricing (Credits)</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left p-4 text-gray-400 font-medium">Feature</th>
                <th className="text-left p-4 text-gray-400 font-medium">Credits Cost</th>
                <th className="text-left p-4 text-gray-400 font-medium">Description</th>
                <th className="text-right p-4 text-gray-400 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pricing.map((item) => (
                <tr key={item.feature} className="border-b border-gray-800/50">
                  <td className="p-4 text-white font-medium">{item.feature.replace('_', ' ')}</td>
                  <td className="p-4 text-indigo-400">{item.credits_cost}</td>
                  <td className="p-4 text-gray-400">{item.description}</td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => { setEditing(item); setCost(item.credits_cost.toString()); }}
                      className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm text-white"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Credit Packages */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <div className="p-4 border-b border-gray-800">
          <h2 className="text-lg font-semibold text-white">Credit Packages</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left p-4 text-gray-400 font-medium">Package</th>
                <th className="text-left p-4 text-gray-400 font-medium">Credits</th>
                <th className="text-left p-4 text-gray-400 font-medium">Price (USD)</th>
                <th className="text-left p-4 text-gray-400 font-medium">Price (USDT)</th>
                <th className="text-left p-4 text-gray-400 font-medium">Bonus</th>
                <th className="text-left p-4 text-gray-400 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {packages.map((pkg) => (
                <tr key={pkg.id} className="border-b border-gray-800/50">
                  <td className="p-4 text-white font-medium">{pkg.name}</td>
                  <td className="p-4 text-indigo-400">{pkg.credits}</td>
                  <td className="p-4 text-white">${pkg.price_usd}</td>
                  <td className="p-4 text-white">{pkg.price_usdt} USDT</td>
                  <td className="p-4 text-green-400">{pkg.bonus_credits > 0 ? `+${pkg.bonus_credits}` : '-'}</td>
                  <td className="p-4">
                    <span className="px-2 py-1 rounded text-xs bg-green-500/20 text-green-400">Active</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-xl p-6 w-full max-w-md border border-gray-800">
            <h3 className="text-lg font-semibold text-white mb-4">
              Edit: {editing.feature.replace('_', ' ')}
            </h3>
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">Credits Cost</label>
              <input
                type="number"
                step="0.1"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => { setEditing(null); setCost(''); }}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdate}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-white"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
