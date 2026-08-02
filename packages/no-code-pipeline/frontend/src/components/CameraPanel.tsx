import React, { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api';

interface CameraDevice {
  device: string;
  name: string;
  type: string;
  driver?: string;
}

export default function CameraPanel() {
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [selectedInput, setSelectedInput] = useState('default');
  const [selectedOutput, setSelectedOutput] = useState('/dev/video0');
  const [resolution, setResolution] = useState('1280x720');
  const [fps, setFps] = useState(30);
  const [streaming, setStreaming] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const mediaRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const timerRef = useRef<number | null>(null);
  const previewRef = useRef<string | null>(null);

  const clearPreview = useCallback(() => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = null;
    setPreviewUrl(null);
  }, []);

  const stopStream = useCallback(() => {
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    timerRef.current = null;
    wsRef.current?.close();
    wsRef.current = null;
    mediaRef.current?.getTracks().forEach((track) => track.stop());
    mediaRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    clearPreview();
    setStreaming(false);
  }, [clearPreview]);

  useEffect(() => {
    void detectCameras();
    return stopStream;
  }, [stopStream]);

  const detectCameras = async () => {
    try {
      const data = await api.listCameras();
      setCameras(data.cameras || []);
    } catch {
      setCameras([]);
    }
  };

  const startStream = async () => {
    stopStream();
    if (!navigator.mediaDevices?.getUserMedia) {
      window.alert('Camera access is not supported in this browser.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      const ws = new WebSocket(api.getStreamUrl());
      ws.binaryType = 'blob';
      wsRef.current = ws;
      mediaRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      ws.onopen = () => {
        setStreaming(true);
        const canvas = canvasRef.current;
        const video = videoRef.current;
        if (!canvas || !video) return;
        canvas.width = 640;
        canvas.height = 480;
        timerRef.current = window.setInterval(() => {
          if (ws.readyState !== WebSocket.OPEN) return;
          const context = canvas.getContext('2d');
          if (!context || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          canvas.toBlob((blob) => {
            if (blob && ws.readyState === WebSocket.OPEN) ws.send(blob);
          }, 'image/jpeg', 0.82);
        }, Math.max(33, Math.round(1000 / fps)));
      };
      ws.onmessage = (event) => {
        const nextUrl = URL.createObjectURL(event.data as Blob);
        if (previewRef.current) URL.revokeObjectURL(previewRef.current);
        previewRef.current = nextUrl;
        setPreviewUrl(nextUrl);
      };
      ws.onerror = stopStream;
      ws.onclose = () => setStreaming(false);
    } catch (error) {
      stopStream();
      console.error('Camera stream failed:', error);
    }
  };

  const renderType = (type: string) => {
    const label = type === 'v4l2loopback' ? 'V4L2' : type === 'obs_virtual' ? 'OBS' : type || 'Unknown';
    return <span className="badge">{label}</span>;
  };

  return (
    <div className="flex flex-col gap-3 md:gap-4">
      <h2 className="text-xs md:text-sm font-semibold text-gray-300 uppercase tracking-wider">Camera Manager</h2>
      <video ref={videoRef} className="hidden" muted playsInline />
      <canvas ref={canvasRef} className="hidden" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
        <div className="card p-3 md:p-4 flex flex-col">
          <span className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-3">Processed Preview</span>
          <div className="bg-gray-800/50 rounded-lg min-h-[150px] flex items-center justify-center overflow-hidden">
            {previewUrl ? <img src={previewUrl} alt="Processed camera preview" className="w-full h-full object-contain" /> : <span className="text-xs text-gray-600">No preview</span>}
          </div>
          <div className="mt-3 space-y-2">
            <select value={selectedInput} onChange={(e) => setSelectedInput(e.target.value)} className="select w-full text-xs md:text-sm" aria-label="Camera input">
              <option value="default">Browser camera</option>
              {cameras.map((camera) => <option key={camera.device} value={camera.device}>{camera.name}</option>)}
            </select>
            <div className="flex gap-2">
              <button onClick={() => void startStream()} disabled={streaming} className="btn-primary flex-1 text-xs py-1.5">Start</button>
              <button onClick={stopStream} disabled={!streaming} className="btn-secondary flex-1 text-xs py-1.5">Stop</button>
            </div>
          </div>
        </div>

        <div className="card p-3 md:p-4 flex flex-col">
          <span className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-3">Virtual Output</span>
          <div className="bg-gray-800/50 rounded-lg min-h-[150px] flex items-center justify-center">
            <span className="text-xs text-gray-600">{streaming ? 'Sending processed frames' : 'Virtual camera is idle'}</span>
          </div>
          <div className="mt-3 space-y-2">
            <select value={selectedOutput} onChange={(e) => setSelectedOutput(e.target.value)} className="select w-full text-xs md:text-sm" aria-label="Virtual camera output">
              {cameras.map((camera) => <option key={camera.device} value={camera.device}>{camera.name}</option>)}
            </select>
            <div className="flex gap-2">
              <select value={resolution} onChange={(e) => setResolution(e.target.value)} className="select flex-1 text-xs md:text-sm" aria-label="Output resolution">
                <option value="640x480">640x480</option><option value="1280x720">1280x720</option><option value="1920x1080">1920x1080</option>
              </select>
              <select value={fps} onChange={(e) => setFps(Number(e.target.value))} className="select flex-1 text-xs md:text-sm" aria-label="Output frame rate">
                <option value={24}>24 FPS</option><option value={30}>30 FPS</option><option value={60}>60 FPS</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="card p-3 md:p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">Detected Devices</span>
          <button onClick={() => void detectCameras()} className="text-xs text-indigo-400 hover:text-indigo-300">Refresh</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs md:text-sm">
            <thead><tr className="text-[10px] md:text-xs text-gray-500 border-b border-gray-800"><th className="text-left py-2">Device</th><th className="text-left py-2">Name</th><th className="text-left py-2">Type</th></tr></thead>
            <tbody>
              {cameras.map((camera) => <tr key={camera.device} className="border-b border-gray-800/50"><td className="py-2 font-mono text-[10px] md:text-xs">{camera.device}</td><td className="py-2">{camera.name}</td><td className="py-2">{renderType(camera.type)}</td></tr>)}
              {cameras.length === 0 && <tr><td colSpan={3} className="py-4 text-center text-gray-500">No devices found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
