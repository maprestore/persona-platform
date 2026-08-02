import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useEngineWebSocket, TrackingData } from '../hooks/useWebSocket';

const ENGINE_URL = import.meta.env.VITE_ENGINE_URL || 'http://localhost:6967';

interface CameraDevice {
  deviceId: string;
  label: string;
  kind: string;
}

export default function LiveSwapPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sourceInputRef = useRef<HTMLInputElement>(null);
  const animFrameRef = useRef<number>();
  const streamRef = useRef<MediaStream | null>(null);

  const [running, setRunning] = useState(false);
  const [mirror, setMirror] = useState(true);
  const [facing, setFacing] = useState<'user' | 'environment'>('user');
  const [mode, setMode] = useState<'live' | 'photo'>('live');
  const [status, setStatus] = useState({ text: 'Ready', type: 'warn' as 'ok' | 'warn' | 'err' });
  const [sourceLabel, setSourceLabel] = useState('+ Face');
  const [sourceFaceId, setSourceFaceId] = useState<string | null>(null);
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [selectedCamera, setSelectedCamera] = useState('user');
  const [showPairPanel, setShowPairPanel] = useState(false);

  // Tracking toggles
  const [trackingEnabled, setTrackingEnabled] = useState(true);
  const [expressionTransfer, setExpressionTransfer] = useState(true);
  const [headPoseTransfer, setHeadPoseTransfer] = useState(true);
  const [handOverlay, setHandOverlay] = useState(true);
  const [trackingInfo, setTrackingInfo] = useState('');

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

  const onTracking = useCallback((data: TrackingData) => {
    let info = '';
    if (data.head_pose) {
      info += `Pitch:${data.head_pose.pitch.toFixed(1)}° Yaw:${data.head_pose.yaw.toFixed(1)}° `;
    }
    if (data.expression) {
      if (data.expression.mouth_open > 0.3) info += ' Mouth:Open ';
      if (data.expression.mouth_smile > 0.3) info += ' Smile ';
    }
    if (data.left_hand?.detected) info += ` Left:${data.left_hand.gesture} `;
    if (data.right_hand?.detected) info += ` Right:${data.right_hand.gesture} `;
    setTrackingInfo(info || 'Tracking active');
  }, []);

  const ws = useEngineWebSocket({
    engineUrl: ENGINE_URL,
    onFrame,
    onTracking,
    onConnect: () => setStatus({ text: 'Connected', type: 'ok' }),
    onDisconnect: () => setStatus({ text: 'Disconnected', type: 'err' }),
    onError: (msg) => setStatus({ text: msg, type: 'err' }),
  });

  // Enumerate cameras
  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then((devices) => {
      setCameras(devices.filter((d) => d.kind === 'videoinput'));
    }).catch(() => {});
  }, []);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      ws.connect();
      setRunning(true);
      setStatus({ text: 'Running', type: 'ok' });

      // Start frame loop
      const loop = (now: number) => {
        if (!videoRef.current?.srcObject) return;
        ws.sendFrame(videoRef.current, mirror);
        animFrameRef.current = requestAnimationFrame(loop);
      };
      animFrameRef.current = requestAnimationFrame(loop);
    } catch (e: any) {
      setStatus({ text: `Camera: ${e.message}`, type: 'err' });
    }
  }, [facing, mirror, ws]);

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
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  }, [ws]);

  const handleSourceUpload = useCallback(async (file: File) => {
    setSourceLabel('Uploading...');
    const id = await ws.uploadSourceFace(file);
    if (id) {
      setSourceFaceId(id);
      setSourceLabel(`✓ ${file.name}`);
      setStatus({ text: 'Source loaded', type: 'ok' });
    } else {
      setSourceLabel('Failed');
      setStatus({ text: 'Upload error', type: 'err' });
    }
  }, [ws]);

  const toggleCamera = useCallback(() => {
    const newFacing = facing === 'user' ? 'environment' : 'user';
    setFacing(newFacing);
    if (running) {
      stopCamera();
      setTimeout(() => {
        setFacing(newFacing);
        startCamera();
      }, 200);
    }
  }, [facing, running, startCamera, stopCamera]);

  const handleTrackingToggle = useCallback((type: string, enabled: boolean, setter: (v: boolean) => void) => {
    setter(enabled);
    ws.toggleTracking(type, enabled);
  }, [ws]);

  const photoMode = useCallback(async () => {
    if (!sourceFaceId || !videoRef.current) return;
    // Capture frame and send for swap
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 1280;
    canvas.height = videoRef.current.videoHeight || 720;
    canvas.getContext('2d')!.drawImage(videoRef.current, 0, 0);
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const form = new FormData();
      form.append('file', new File([blob], 'selfie.png'));
      try {
        const uploadRes = await fetch(`${ENGINE_URL}/upload`, { method: 'POST', body: form });
        const { file_id } = await uploadRes.json();
        const swapRes = await fetch(`${ENGINE_URL}/swap`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source_id: sourceFaceId, target_id: file_id, no_watermark: true }),
        });
        const { output_url } = await swapRes.json();
        if (output_url && canvasRef.current) {
          const img = new Image();
          img.onload = () => {
            const canvas = canvasRef.current!;
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
          };
          img.src = `${ENGINE_URL}${output_url}`;
        }
      } catch (e) {
        console.error('Photo swap failed:', e);
      }
    }, 'image/png');
  }, [sourceFaceId, mirror]);

  return (
    <div className="h-full flex flex-col bg-gray-950">
      {/* Video Area */}
      <div className="flex-1 relative bg-black flex items-center justify-center min-h-0">
        <video ref={videoRef} autoPlay playsInline muted className="hidden" />
        <canvas ref={canvasRef} className="w-full h-full object-contain" />

        {/* Status Badges */}
        <div className="absolute top-3 left-3 right-3 flex justify-between pointer-events-none z-10">
          <span className={`px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-xl ${
            status.type === 'ok' ? 'bg-emerald-600/60 text-emerald-300 border border-emerald-600/80' :
            status.type === 'err' ? 'bg-red-600/60 text-red-300 border border-red-600/80' :
            'bg-amber-600/60 text-amber-300 border border-amber-600/80'
          }`}>
            {status.text}
          </span>
          {running && (
            <span className={`px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-xl ${
              ws.fps > 20 ? 'bg-emerald-600/60 text-emerald-300 border border-emerald-600/80' :
              'bg-amber-600/60 text-amber-300 border border-amber-600/80'
            }`}>
              {ws.fps} FPS
            </span>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="bg-gradient-to-t from-gray-900 via-gray-900/95 to-gray-900/85 border-t border-gray-800 p-3 sm:p-4 space-y-3">
        {/* Row 1: Start/Stop + Flip + Pair */}
        <div className="flex gap-3 items-center justify-center">
          {!running ? (
            <button onClick={startCamera} className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-colors">
              ▶ Start
            </button>
          ) : (
            <button onClick={stopCamera} className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-xl transition-colors">
              ⏹ Stop
            </button>
          )}
          <button onClick={toggleCamera} className="p-3 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl transition-colors" title="Flip camera">
            ↻
          </button>
          <button onClick={() => setShowPairPanel(true)} className="px-4 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl transition-colors text-sm">
            📱 Pair
          </button>
        </div>

        {/* Row 2: Mode + Source + Mirror + Camera Select */}
        <div className="flex gap-3 items-center justify-between">
          <div className="flex gap-1 bg-gray-800/60 rounded-xl p-1">
            <button
              onClick={() => setMode('live')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${mode === 'live' ? 'bg-indigo-600 text-white' : 'text-gray-400'}`}
            >
              Live
            </button>
            <button
              onClick={() => { setMode('photo'); photoMode(); }}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${mode === 'photo' ? 'bg-indigo-600 text-white' : 'text-gray-400'}`}
            >
              Photo
            </button>
          </div>

          <input
            ref={sourceInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleSourceUpload(e.target.files[0])}
          />
          <button
            onClick={() => sourceInputRef.current?.click()}
            className="px-4 py-2 bg-gray-800/60 border border-dashed border-gray-600 rounded-xl text-gray-400 text-sm hover:bg-gray-700 transition-colors"
          >
            {sourceLabel}
          </button>

          <button
            onClick={() => setMirror(!mirror)}
            className={`p-2 rounded-xl transition-colors ${mirror ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400'}`}
            title="Mirror"
          >
            ⇔
          </button>

          <select
            value={selectedCamera}
            onChange={(e) => {
              setSelectedCamera(e.target.value);
              if (running) { stopCamera(); setTimeout(startCamera, 200); }
            }}
            className="bg-gray-800/60 text-gray-300 border border-gray-700 rounded-xl px-3 py-2 text-sm appearance-none"
          >
            <option value="user">Front</option>
            <option value="environment">Rear</option>
            {cameras.filter(c => !c.label.toLowerCase().includes('front') && !c.label.toLowerCase().includes('back')).map((c, i) => (
              <option key={c.deviceId} value={c.deviceId}>{c.label || `Cam ${i + 1}`}</option>
            ))}
          </select>
        </div>

        {/* Row 3: Tracking Toggles */}
        <div className="flex gap-2 items-center justify-center flex-wrap">
          <button
            onClick={() => handleTrackingToggle('tracking', !trackingEnabled, setTrackingEnabled)}
            className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${trackingEnabled ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400'}`}
          >
            🎯 Track
          </button>
          <button
            onClick={() => handleTrackingToggle('expression-transfer', !expressionTransfer, setExpressionTransfer)}
            className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${expressionTransfer ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400'}`}
          >
            😊 Expr
          </button>
          <button
            onClick={() => handleTrackingToggle('head-pose-transfer', !headPoseTransfer, setHeadPoseTransfer)}
            className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${headPoseTransfer ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400'}`}
          >
            🗣 Head
          </button>
          <button
            onClick={() => handleTrackingToggle('hand-overlay', !handOverlay, setHandOverlay)}
            className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${handOverlay ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400'}`}
          >
            ✋ Hands
          </button>
        </div>

        {/* Tracking Info */}
        {running && trackingInfo && (
          <div className="text-center text-xs text-indigo-400 py-1">
            {trackingInfo}
          </div>
        )}

        <div className="text-center text-[10px] text-gray-600">
          Open this page on your phone for remote camera • Share screen in video calls
        </div>
      </div>

      {/* Phone Pair Panel */}
      {showPairPanel && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-xl z-50 flex items-center justify-center flex-col gap-4 p-6">
          <button
            onClick={() => setShowPairPanel(false)}
            className="absolute top-4 right-4 w-9 h-9 bg-white/10 rounded-full flex items-center justify-center text-white text-xl"
          >
            ×
          </button>
          <h2 className="text-lg font-semibold text-gray-200">📱 Phone as Camera</h2>
          <p className="text-sm text-gray-400 text-center max-w-xs leading-relaxed">
            Open this URL on your phone to use its camera as a remote source for this device:
          </p>
          <div className="bg-white/5 rounded-xl px-5 py-3 text-center">
            <code className="text-indigo-400 text-sm break-all user-select-all">
              {window.location.origin}
            </code>
          </div>
          <button
            onClick={() => {
              navigator.clipboard.writeText(window.location.origin);
            }}
            className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-colors"
          >
            📋 Copy URL
          </button>
          <p className="text-[11px] text-gray-600 mt-1">
            Open the URL on your phone's browser. The camera feed will stream here.
          </p>
        </div>
      )}
    </div>
  );
}
