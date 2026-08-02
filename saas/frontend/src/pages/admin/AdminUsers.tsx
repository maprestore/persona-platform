import React, { useEffect, useState } from 'react';
import api from '../../api';

export default function AdminUsers() {
  const [users, setUsers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [credits, setCredits] = useState('');

  useEffect(() => {
    loadUsers();
  }, [page, search]);

  const loadUsers = () => {
    api.get(`/api/admin/users?page=${page}&search=${search}`).then(res => {
      setUsers(res.data.users);
      setTotal(res.data.total);
    });
  };

  const handleUpdate = async () => {
    if (!editingUser) return;
    await api.put(`/api/admin/users/${editingUser.id}`, {
      credits: credits ? parseFloat(credits) : undefined,
    });
    setEditingUser(null);
    setCredits('');
    loadUsers();
  };

  const handleToggleActive = async (userId: string, isActive: boolean) => {
    await api.put(`/api/admin/users/${userId}`, { is_active: !isActive });
    loadUsers();
  };

  const handleToggleAdmin = async (userId: string, isAdmin: boolean) => {
    await api.put(`/api/admin/users/${userId}`, { is_admin: !isAdmin });
    loadUsers();
  };

  const handleDelete = async (userId: string) => {
    if (!confirm('Delete this user? This cannot be undone.')) return;
    await api.delete(`/api/admin/users/${userId}`);
    loadUsers();
  };

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">User Management</h1>
        <p className="text-gray-400 mt-1">{total} total users</p>
      </div>

      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search users..."
          className="w-full md:w-96 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500"
        />
      </div>

      {/* Users Table */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left p-4 text-gray-400 font-medium">User</th>
                <th className="text-left p-4 text-gray-400 font-medium">Credits</th>
                <th className="text-left p-4 text-gray-400 font-medium">Status</th>
                <th className="text-left p-4 text-gray-400 font-medium">Role</th>
                <th className="text-left p-4 text-gray-400 font-medium">Joined</th>
                <th className="text-right p-4 text-gray-400 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="p-4">
                    <div>
                      <p className="text-white font-medium">{user.username}</p>
                      <p className="text-sm text-gray-400">{user.email}</p>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="text-indigo-400 font-medium">{user.credits}</span>
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-xs ${
                      user.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                    }`}>
                      {user.is_active ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-xs ${
                      user.is_admin ? 'bg-purple-500/20 text-purple-400' : 'bg-gray-500/20 text-gray-400'
                    }`}>
                      {user.is_admin ? 'Admin' : 'User'}
                    </span>
                  </td>
                  <td className="p-4 text-sm text-gray-400">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-1 flex-wrap">
                      <button
                        onClick={() => { setEditingUser(user); setCredits(user.credits.toString()); }}
                        className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs text-white"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleToggleActive(user.id, user.is_active)}
                        className={`px-2 py-1 rounded text-xs ${
                          user.is_active ? 'bg-yellow-600 hover:bg-yellow-500 text-white' : 'bg-green-600 hover:bg-green-500 text-white'
                        }`}
                      >
                        {user.is_active ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        onClick={() => handleToggleAdmin(user.id, user.is_admin)}
                        className={`px-2 py-1 rounded text-xs ${
                          user.is_admin ? 'bg-gray-600 hover:bg-gray-500 text-white' : 'bg-purple-600 hover:bg-purple-500 text-white'
                        } hidden sm:inline-block`}
                      >
                        {user.is_admin ? 'Remove Admin' : 'Make Admin'}
                      </button>
                      <button
                        onClick={() => handleDelete(user.id)}
                        className="px-2 py-1 bg-red-600 hover:bg-red-500 rounded text-xs text-white"
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
      </div>

      {/* Pagination */}
      {total > 20 && (
        <div className="mt-4 flex justify-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1 bg-gray-800 rounded text-white disabled:opacity-50"
          >
            Previous
          </button>
          <span className="px-3 py-1 text-gray-400">Page {page}</span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={users.length < 20}
            className="px-3 py-1 bg-gray-800 rounded text-white disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}

      {/* Edit Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-xl p-6 w-full max-w-md border border-gray-800">
            <h3 className="text-lg font-semibold text-white mb-4">Edit User: {editingUser.username}</h3>
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">Credits</label>
              <input
                type="number"
                value={credits}
                onChange={(e) => setCredits(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => { setEditingUser(null); setCredits(''); }}
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
