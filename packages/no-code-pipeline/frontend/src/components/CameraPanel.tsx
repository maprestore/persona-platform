import React, { useState, useEffect } from 'react';
import { api } from '../api';

interface CameraDevice {
  device: string;
  name: string;
  type: string;
  driver?: string;
}

export default function CameraPanel() {
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [selectedInput, setSelectedInput] = useState('/dev/video0');
  const [selectedOutput, setSelectedOutput] = useState('/dev/video0');
  const [resolution, setResolution] = useState('1280x720');
  const [fps, setFps] = useState(30);
  const [streaming, setStreaming] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    detectCameras();
  }, []);

  const detectCameras = async () => {
    try {
      const data = await api.listCameras();
      setCameras(data.cameras || []);
    } catch {
      setCameras([]);
    }
  };

  const startStream = async () => {
    try {
      const ws = new WebSocket(api.getStreamUrl());
      ws.onopen = () => setStreaming(true);
      ws.onmessage = (event) => {
        if (event.data instanceof Blob) {
          const url = URL.createObjectURL(event.data);
          setPreviewUrl(url);
        }
      };
      ws.onerror = () => setStreaming(false);
      ws.onclose = () => setStreaming(false);
    } catch {
      setStreaming(false);
    }
  };

  const stopStream = () => {
    setStreaming(false);
    setPreviewUrl(null);
  };

  return (
    <div className="flex flex-col gap-3 md:gap-4">
      <h2 className="text-xs md:text-sm font-semibold text-gray-300 uppercase tracking-wider">Camera Manager</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
        {/* Input */}
        <div className="card p-3 md:p-4 flex flex-col">
          <span className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-3">Input Source</span>
          <div className="bg-gray-800/50 rounded-lg min-h-[150px] md:flex-1 flex items-center justify-center overflow-hidden">
            {previewUrl ? (
              <img src={previewUrl} alt="Preview" className="w-full h-full object-contain" />
            ) : (
              <div className="text-center text-gray-600 py-8">
                <svg className="w-10 h-10 md:w-12 md:h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <span className="text-xs md:text-sm">No preview</span>
              </div>
            )}
          </div>
          <div className="mt-3 space-y-2">
            <select value={selectedInput} onChange={(e) => setSelectedInput(e.target.value)} className="select w-full text-xs md:text-sm">
              {cameras.map((c) => (
                <option key={c.device} value={c.device}>{c.name}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <button onClick={startStream} disabled={streaming} className="btn-primary flex-1 text-xs py-1.5">
                Start
              </button>
              <button onClick={stopStream} disabled={!streaming} className="btn-secondary flex-1 text-xs py-1.5">
                Stop
              </button>
            </div>
          </div>
        </div>

        {/* Output */}
        <div className="card p-3 md:p-4 flex flex-col">
          <span className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-3">Virtual Output</span>
          <div className="bg-gray-800/50 rounded-lg min-h-[150px] md:flex-1 flex items-center justify-center">
            <div className="text-center text-gray-600 py-8">
              <svg className="w-10 h-10 md:w-12 md:h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <span className="text-xs md:text-sm">Virtual camera output</span>
            </div>
          </div>
          <div className="mt-3 space-y-2">
            <select value={selectedOutput} onChange={(e) => setSelectedOutput(e.target.value)} className="select w-full text-xs md:text-sm">
              {cameras.map((c) => (
                <option key={c.device} value={c.device}>{c.name}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <select value={resolution} onChange={(e) => setResolution(e.target.value)} className="select flex-1 text-xs md:text-sm">
                <option value="640x480">640x480</option>
                <option value="1280x720">1280x720</option>
                <option value="1920x1080">1920x1080</option>
              </select>
              <select value={fps} onChange={(e) => setFps(Number(e.target.value))} className="select flex-1 text-xs md:text-sm">
                <option value={24}>24 FPS</option>
                <option value={30}>30 FPS</option>
                <option value={60}>60 FPS</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Devices Table */}
      <div className="card p-3 md:p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">Detected Devices</span>
          <button onClick={detectCameras} className="text-xs text-indigo-400 hover:text-indigo-300">Refresh</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs md:text-sm">
            <thead>
              <tr className="text-[10px] md:text-xs text-gray-500 border-b border-gray-800">
                <th className="text-left py-2">Device</th>
                <th className="text-left py-2 hidden sm:table-cell">Name</th>
                <th className="text-left py-2 hidden md:table-cell">Driver</th>
                <th className="text-left py-2">Type</th>
              </tr>
            </thead>
            <tbody>
              {cameras.map((cam) => (
                <tr key={cam.device} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="py-2 font-mono text-[10px] md:text-xs">{cam.device}</td>
                  <td className="py-2 hidden sm:table-cell">{cam.name}</td>
                  <td className="py-2 text-gray-400 hidden md:table-cell">{cam.driver || '-'}</td>
                  <td className="py-2">
                    {cam.type === 'v4l2loopback' && <span className="badge-green">V4L2</span>}
                    {cam.type === 'obs_virtual' && <span className="badge-blue">OBS</span>}
                    {cam.type === 'manycam' && <span className="badge-yellow">ManyCam</span>}
                    {cam.type === 'virtual_output' && <span className="badge-green">Output</span>}
                    {cam.type === 'capture' && <span className="badge">Capture</span>}
                    {cam.type === 'unknown' && <span className="badge">Unknown</span>}
                  </td>
                </tr>
              ))}
              {cameras.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-gray-500">
                    No devices found. Install v4l2loopback: <code className="text-indigo-400 text-[10px] md:text-xs">sudo apt install v4l2loopback-dkms</code>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
