import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useEngineWebSocket } from '../hooks/useWebSocket';

const ENGINE_URL = import.meta.env.VITE_ENGINE_URL || 'http://localhost:6967';

export default function PhonePairPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>();
  const streamRef = useRef<MediaStream | null>(null);

  const [running, setRunning] = useState(false);
  const [mirror, setMirror] = useState(false);
  const [status, setStatus] = useState({ text: 'Ready', type: 'warn' as 'ok' | 'warn' | 'err' });
  const [pairUrl, setPairUrl] = useState('');
  const [copied, setCopied] = useState(false);

  const onFrame = useCallback((blob: Blob) => {
    if (!canvasRef.current) return;
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d')!;
      if (mirror) {
        ctx.save();
        ctx.translate(img.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(img, 0, 0);
        ctx.restore();
      } else {
        ctx.drawImage(img, 0, 0);
      }
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }, [mirror]);

  const ws = useEngineWebSocket({
    engineUrl: ENGINE_URL,
    onFrame,
    onConnect: () => setStatus({ text: 'Connected', type: 'ok' }),
    onDisconnect: () => setStatus({ text: 'Disconnected', type: 'err' }),
    onError: (msg) => setStatus({ text: msg, type: 'err' }),
  });

  useEffect(() => {
    setPairUrl(window.location.origin);
  }, []);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      ws.connect();
      setRunning(true);
      setStatus({ text: 'Streaming to server', type: 'ok' });

      const loop = () => {
        if (!videoRef.current?.srcObject) return;
        ws.sendFrame(videoRef.current, mirror);
        animFrameRef.current = requestAnimationFrame(loop);
      };
      animFrameRef.current = requestAnimationFrame(loop);
    } catch (e: any) {
      setStatus({ text: `Camera: ${e.message}`, type: 'err' });
    }
  }, [mirror, ws]);

  const stopCamera = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    ws.disconnect();
    setRunning(false);
    setStatus({ text: 'Stopped', type: 'warn' });
  }, [ws]);

  const copyUrl = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(pairUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = pairUrl;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [pairUrl]);

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">📱 Phone as Camera</h1>
        <p className="text-gray-400 mt-1">Use your phone's camera as a remote source for the Persona Studio on your computer</p>
      </div>

      {/* Pair URL */}
      <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-2xl p-6 text-center space-y-4">
        <h3 className="text-lg font-semibold text-white">Pair Your Phone</h3>
        <p className="text-sm text-gray-400">Open this URL on your phone's browser:</p>
        <div className="bg-gray-900 rounded-xl px-5 py-3 inline-block">
          <code className="text-indigo-400 text-lg break-all select-all">{pairUrl}</code>
        </div>
        <button
          onClick={copyUrl}
          className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-colors"
        >
          {copied ? '✅ Copied!' : '📋 Copy URL'}
        </button>
        <p className="text-xs text-gray-600">Your phone and computer must be on the same network</p>
      </div>

      {/* Camera Preview */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="relative bg-black aspect-video flex items-center justify-center">
          <video ref={videoRef} autoPlay playsInline muted className="hidden" />
          <canvas ref={canvasRef} className="w-full h-full object-contain" />

          <div className="absolute top-3 left-3">
            <span className={`px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-xl ${
              status.type === 'ok' ? 'bg-emerald-600/60 text-emerald-300 border border-emerald-600/80' :
              status.type === 'err' ? 'bg-red-600/60 text-red-300 border border-red-600/80' :
              'bg-amber-600/60 text-amber-300 border border-amber-600/80'
            }`}>
              {status.text}
            </span>
          </div>

          {ws.fps > 0 && running && (
            <div className="absolute top-3 right-3">
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-600/60 text-emerald-300 border border-emerald-600/80 backdrop-blur-xl">
                {ws.fps} FPS
              </span>
            </div>
          )}
        </div>

        <div className="p-4 space-y-3">
          <div className="flex gap-3">
            {!running ? (
              <button onClick={startCamera} className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-colors">
                ▶ Start Streaming
              </button>
            ) : (
              <button onClick={stopCamera} className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-xl transition-colors">
                ⏹ Stop
              </button>
            )}
            <button
              onClick={() => setMirror(!mirror)}
              className={`px-4 py-3 rounded-xl transition-colors ${mirror ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400'}`}
            >
              ⇔ Mirror
            </button>
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-3">
        <h3 className="text-lg font-semibold text-white">Instructions</h3>
        <ol className="text-sm text-gray-400 space-y-2 list-decimal list-inside">
          <li>Open this page on your phone using the URL above</li>
          <li>On your computer, go to <span className="text-indigo-400">Live Swap</span> and click "📱 Pair"</li>
          <li>Your phone's camera feed will be sent to the engine for processing</li>
          <li>The processed output (with face swap) will appear on your computer</li>
          <li>Use this for video calls by sharing your screen</li>
        </ol>
      </div>
    </div>
  );
}
