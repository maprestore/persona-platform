import React, { useState, useEffect } from 'react';
import { api } from '../api';

interface Camera {
  device: string;
  name: string;
  type: string;
  driver?: string;
}

export default function VirtualCamPanel() {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [selectedDevice, setSelectedDevice] = useState('/dev/video0');
  const [resolution, setResolution] = useState('1280x720');
  const [fps, setFps] = useState(30);
  const [active, setActive] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    detectCameras();
  }, []);

  const detectCameras = async () => {
    try {
      const data = await api.listCameras();
      setCameras(data.cameras || []);
      if (data.cameras?.length > 0) {
        const virtual = data.cameras.find((c: Camera) =>
          c.type === 'v4l2loopback' || c.type === 'obs_virtual' || c.type === 'virtual_output'
        );
        if (virtual) setSelectedDevice(virtual.device);
      }
    } catch {
      setCameras([{ device: '/dev/video0', name: 'Default Camera', type: 'unknown' }]);
    }
  };

  const startVirtualCam = async () => {
    setLoading(true);
    try {
      const [w, h] = resolution.split('x').map(Number);
      const data = await api.startVirtualCam(selectedDevice, w, h, fps);
      setActive(data.status === 'ok');
    } catch {
      setActive(false);
    } finally {
      setLoading(false);
    }
  };

  const stopVirtualCam = async () => {
    try {
      await api.stopVirtualCam();
      setActive(false);
    } catch {}
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'v4l2loopback': return <span className="badge-green text-[10px]">V4L2</span>;
      case 'obs_virtual': return <span className="badge-blue text-[10px]">OBS</span>;
      case 'manycam': return <span className="badge-yellow text-[10px]">ManyCam</span>;
      case 'virtual_output': return <span className="badge-green text-[10px]">Output</span>;
      default: return <span className="badge text-[10px]">{type}</span>;
    }
  };

  return (
    <div className="flex flex-col gap-3 md:gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xs md:text-sm font-semibold text-gray-300 uppercase tracking-wider">Virtual Camera</h2>
        {active ? (
          <span className="badge-green flex items-center gap-1">
            <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
            Active
          </span>
        ) : (
          <span className="badge-red">Inactive</span>
        )}
      </div>

      {/* Devices */}
      <div className="card p-2 md:p-3">
        <div className="flex items-center justify-between mb-2 md:mb-3">
          <span className="text-[10px] md:text-xs text-gray-500 font-medium uppercase tracking-wider">Devices</span>
          <button onClick={detectCameras} className="text-[10px] md:text-xs text-indigo-400 hover:text-indigo-300">
            Refresh
          </button>
        </div>
        <div className="space-y-1.5 md:space-y-2 max-h-32 md:max-h-40 overflow-y-auto">
          {cameras.length === 0 ? (
            <div className="text-[10px] md:text-xs text-gray-500 text-center py-3">
              Install v4l2loopback: <code className="text-indigo-400">sudo apt install v4l2loopback-dkms</code>
            </div>
          ) : (
            cameras.map((cam) => (
              <div
                key={cam.device}
                onClick={() => setSelectedDevice(cam.device)}
                className={`p-1.5 md:p-2 rounded-lg cursor-pointer border transition-all ${
                  selectedDevice === cam.device
                    ? 'border-indigo-500 bg-indigo-500/10'
                    : 'border-gray-800 hover:border-gray-700 bg-gray-800/30'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="text-xs md:text-sm font-medium truncate">{cam.name}</div>
                    <div className="text-[10px] text-gray-500 truncate">{cam.device}</div>
                  </div>
                  {getTypeBadge(cam.type)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Settings */}
      <div className="card p-2 md:p-3">
        <span className="text-[10px] md:text-xs text-gray-500 font-medium uppercase tracking-wider">Settings</span>
        <div className="mt-2 md:mt-3 space-y-2 md:space-y-3">
          <div>
            <label className="text-[10px] md:text-xs text-gray-400 mb-1 block">Resolution</label>
            <select value={resolution} onChange={(e) => setResolution(e.target.value)} className="select w-full text-xs md:text-sm">
              <option value="640x480">640x480 (SD)</option>
              <option value="1280x720">1280x720 (HD)</option>
              <option value="1920x1080">1920x1080 (FHD)</option>
              <option value="3840x2160">3840x2160 (4K)</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] md:text-xs text-gray-400 mb-1 block">Frame Rate</label>
            <select value={fps} onChange={(e) => setFps(Number(e.target.value))} className="select w-full text-xs md:text-sm">
              <option value={24}>24 FPS</option>
              <option value={25}>25 FPS</option>
              <option value={30}>30 FPS</option>
              <option value={60}>60 FPS</option>
            </select>
          </div>
        </div>
      </div>

      {/* Control */}
      <button
        onClick={active ? stopVirtualCam : startVirtualCam}
        disabled={loading}
        className={active ? 'btn-danger w-full py-2.5' : 'btn-primary w-full py-2.5'}
      >
        {loading ? 'Starting...' : active ? 'Stop Virtual Camera' : 'Start Virtual Camera'}
      </button>

      {/* Compatible Apps */}
      <div className="card p-2 md:p-3">
        <span className="text-[10px] md:text-xs text-gray-500 font-medium uppercase tracking-wider">Compatible Apps</span>
        <div className="mt-2 md:mt-3 grid grid-cols-3 md:grid-cols-2 gap-1.5 md:gap-2">
          {[
            { name: 'ManyCam', icon: '🎥' },
            { name: 'OBS', icon: '🎬' },
            { name: 'Zoom', icon: '📹' },
            { name: 'Teams', icon: '💼' },
            { name: 'Discord', icon: '🎮' },
            { name: 'Skype', icon: '📞' },
          ].map((app) => (
            <div key={app.name} className="bg-gray-800/50 rounded-lg p-1.5 md:p-2 text-center">
              <div className="text-sm md:text-lg">{app.icon}</div>
              <div className="text-[10px] md:text-xs font-medium">{app.name}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
