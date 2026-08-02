import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';

const ENGINE_URL = import.meta.env.VITE_ENGINE_URL || 'http://localhost:6967';

interface VirtualCamStatus {
  active: boolean;
  device?: string;
  resolution?: string;
  fps?: number;
}

export default function VirtualCamPage() {
  const [status, setStatus] = useState<VirtualCamStatus>({ active: false });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [device, setDevice] = useState('/dev/video0');
  const [width, setWidth] = useState(1280);
  const [height, setHeight] = useState(720);
  const [camFps, setCamFps] = useState(30);
  const [cameras, setCameras] = useState<string[]>([]);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${ENGINE_URL}/virtual-cam/status`);
      const data = await res.json();
      setStatus(data);
    } catch (e) {
      console.error('Failed to fetch virtual cam status');
    }
  }, []);

  const fetchCameras = useCallback(async () => {
    try {
      const res = await fetch(`${ENGINE_URL}/cameras`);
      const data = await res.json();
      setCameras(data.cameras || []);
    } catch (e) {
      console.error('Failed to fetch cameras');
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    fetchCameras();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, [fetchStatus, fetchCameras]);

  const startVirtualCam = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${ENGINE_URL}/virtual-cam/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device, width, height, fps: camFps }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus({ active: true, device: data.device, resolution: data.resolution, fps: data.fps });
      } else {
        setError(data.detail || 'Failed to start virtual camera');
      }
    } catch (e: any) {
      setError(e.message || 'Failed to connect to engine');
    } finally {
      setLoading(false);
    }
  }, [device, width, height, camFps]);

  const stopVirtualCam = useCallback(async () => {
    setLoading(true);
    try {
      await fetch(`${ENGINE_URL}/virtual-cam/stop`, { method: 'POST' });
      setStatus({ active: false });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Virtual Camera</h1>
        <p className="text-gray-400 mt-1">Create a virtual camera output for use in video calls (Zoom, Teams, Discord, etc.)</p>
      </div>

      {/* Status Card */}
      <div className={`p-6 rounded-2xl border ${status.active ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-gray-900 border-gray-800'}`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">
              {status.active ? '🟢 Virtual Camera Active' : '⚪ Virtual Camera Inactive'}
            </h3>
            {status.active && (
              <div className="mt-2 space-y-1 text-sm text-gray-400">
                <p>Device: <span className="text-white">{status.device}</span></p>
                <p>Resolution: <span className="text-white">{status.resolution}</span></p>
                <p>FPS: <span className="text-white">{status.fps}</span></p>
              </div>
            )}
          </div>
          <div className="w-16 h-16 rounded-full flex items-center justify-center text-3xl" style={{
            background: status.active ? 'rgba(16,185,129,0.2)' : 'rgba(107,114,128,0.2)',
          }}>
            {status.active ? '📷' : '📷'}
          </div>
        </div>
      </div>

      {/* Configuration */}
      {!status.active && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
          <h3 className="text-lg font-semibold text-white">Configuration</h3>

          <div>
            <label className="block text-sm text-gray-400 mb-2">Output Device</label>
            <select
              value={device}
              onChange={(e) => setDevice(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white"
            >
              <option value="/dev/video0">/dev/video0</option>
              <option value="/dev/video1">/dev/video1</option>
              {cameras.map((cam) => (
                <option key={cam} value={cam}>{cam}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Width</label>
              <input
                type="number"
                value={width}
                onChange={(e) => setWidth(parseInt(e.target.value))}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Height</label>
              <input
                type="number"
                value={height}
                onChange={(e) => setHeight(parseInt(e.target.value))}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">FPS</label>
              <input
                type="number"
                value={camFps}
                onChange={(e) => setCamFps(parseInt(e.target.value))}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white"
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}

          <button
            onClick={startVirtualCam}
            disabled={loading}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors"
          >
            {loading ? 'Starting...' : '▶ Start Virtual Camera'}
          </button>
        </div>
      )}

      {/* Stop Button */}
      {status.active && (
        <button
          onClick={stopVirtualCam}
          disabled={loading}
          className="w-full py-3 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors"
        >
          {loading ? 'Stopping...' : '⏹ Stop Virtual Camera'}
        </button>
      )}

      {/* Instructions */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-3">
        <h3 className="text-lg font-semibold text-white">How to Use</h3>
        <ol className="text-sm text-gray-400 space-y-2 list-decimal list-inside">
          <li>Start the virtual camera above</li>
          <li>Open your video call app (Zoom, Teams, Discord, etc.)</li>
          <li>Go to camera settings and select the Persona virtual camera</li>
          <li>Your face will be swapped in real-time during the call</li>
          <li>Use the <span className="text-indigo-400">Live Swap</span> page to set a source face</li>
        </ol>
      </div>
    </div>
  );
}
