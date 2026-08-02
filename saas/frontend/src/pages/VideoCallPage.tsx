import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useEngineWebSocket, TrackingData } from '../hooks/useWebSocket';

const ENGINE_URL = import.meta.env.VITE_ENGINE_URL || 'http://localhost:6967';

interface Participant {
  id: string;
  name: string;
  stream?: MediaStream;
  processedBlob?: Blob;
  tracking?: TrackingData;
  muted: boolean;
  videoOff: boolean;
}

export default function VideoCallPage() {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localCanvasRef = useRef<HTMLCanvasElement>(null);
  const remoteCanvasRefs = useRef<Map<string, HTMLCanvasElement>>(new Map());
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number>();

  const [running, setRunning] = useState(false);
  const [mirror, setMirror] = useState(true);
  const [facing, setFacing] = useState<'user' | 'environment'>('user');
  const [status, setStatus] = useState({ text: 'Ready', type: 'warn' as 'ok' | 'warn' | 'err' });
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [sourceFaceId, setSourceFaceId] = useState<string | null>(null);
  const [sourceLabel, setSourceLabel] = useState('+ Face');
  const sourceInputRef = useRef<HTMLInputElement>(null);
  const [localTracking, setLocalTracking] = useState<TrackingData | null>(null);
  const [muted, setMuted] = useState(true);
  const [videoOff, setVideoOff] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Tracking toggles
  const [trackingEnabled, setTrackingEnabled] = useState(true);
  const [expressionTransfer, setExpressionTransfer] = useState(true);
  const [headPoseTransfer, setHeadPoseTransfer] = useState(true);
  const [handOverlay, setHandOverlay] = useState(true);

  const onFrame = useCallback((blob: Blob) => {
    if (!localCanvasRef.current) return;
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = localCanvasRef.current;
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
    setLocalTracking(data);
  }, []);

  const ws = useEngineWebSocket({
    engineUrl: ENGINE_URL,
    onFrame,
    onTracking,
    onConnect: () => setStatus({ text: 'Connected', type: 'ok' }),
    onDisconnect: () => setStatus({ text: 'Disconnected', type: 'err' }),
    onError: (msg) => setStatus({ text: msg, type: 'err' }),
  });

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        await localVideoRef.current.play();
      }
      ws.connect();
      setRunning(true);
      setStatus({ text: 'Running', type: 'ok' });

      const loop = () => {
        if (!localVideoRef.current?.srcObject) return;
        ws.sendFrame(localVideoRef.current, mirror);
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
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    ws.disconnect();
    setRunning(false);
    setStatus({ text: 'Stopped', type: 'warn' });
  }, [ws]);

  const handleSourceUpload = useCallback(async (file: File) => {
    setSourceLabel('Uploading...');
    const id = await ws.uploadSourceFace(file);
    if (id) {
      setSourceFaceId(id);
      setSourceLabel(`✓ ${file.name}`);
    } else {
      setSourceLabel('Failed');
    }
  }, [ws]);

  const handleTrackingToggle = useCallback((type: string, enabled: boolean, setter: (v: boolean) => void) => {
    setter(enabled);
    ws.toggleTracking(type, enabled);
  }, [ws]);

  const toggleCamera = useCallback(() => {
    const newFacing = facing === 'user' ? 'environment' : 'user';
    setFacing(newFacing);
    if (running) {
      stopCamera();
      setTimeout(() => startCamera(), 200);
    }
  }, [facing, running, startCamera, stopCamera]);

  // Get tracking summary
  const getTrackingSummary = (data: TrackingData | null) => {
    if (!data) return null;
    const parts: string[] = [];
    if (data.head_pose) parts.push(`Yaw:${data.head_pose.yaw.toFixed(0)}°`);
    if (data.expression?.mouth_smile > 0.3) parts.push('😊');
    if (data.left_hand?.detected) parts.push(`✋${data.left_hand.gesture}`);
    if (data.right_hand?.detected) parts.push(`✋${data.right_hand.gesture}`);
    return parts.length > 0 ? parts.join(' ') : null;
  };

  return (
    <div className="h-full flex flex-col bg-gray-950">
      {/* Main Video Grid */}
      <div className="flex-1 p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 auto-rows-fr min-h-0">
        {/* Local Video */}
        <div className="relative bg-black rounded-2xl overflow-hidden border border-gray-800">
          <video ref={localVideoRef} autoPlay playsInline muted className="hidden" />
          <canvas ref={localCanvasRef} className="w-full h-full object-contain" />

          {/* Local overlay */}
          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
            <span className="px-3 py-1 bg-black/60 backdrop-blur-xl rounded-full text-xs text-white font-medium">
              You
            </span>
            <div className="flex gap-2">
              {localTracking && getTrackingSummary(localTracking) && (
                <span className="px-2 py-1 bg-indigo-600/60 backdrop-blur-xl rounded-full text-[10px] text-indigo-200">
                  {getTrackingSummary(localTracking)}
                </span>
              )}
            </div>
          </div>

          {/* Source face indicator */}
          {sourceFaceId && (
            <div className="absolute top-3 left-3">
              <span className="px-2 py-1 bg-emerald-600/60 backdrop-blur-xl rounded-full text-[10px] text-emerald-200">
                🎭 Source Active
              </span>
            </div>
          )}
        </div>

        {/* Remote/Placeholder Videos */}
        {[1, 2, 3].map((i) => (
          <div key={i} className="relative bg-gray-900 rounded-2xl overflow-hidden border border-gray-800 flex items-center justify-center">
            <canvas
              ref={(el) => { if (el) remoteCanvasRefs.current.set(`remote-${i}`, el); }}
              className="w-full h-full object-contain hidden"
            />
            <div className="text-center space-y-3">
              <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto text-2xl text-gray-600">
                👤
              </div>
              <p className="text-sm text-gray-600">Waiting for participant...</p>
            </div>
            <div className="absolute bottom-3 left-3">
              <span className="px-3 py-1 bg-black/60 backdrop-blur-xl rounded-full text-xs text-gray-400 font-medium">
                Participant {i}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Controls Bar */}
      <div className="bg-gradient-to-t from-gray-900 via-gray-900/95 to-gray-900/85 border-t border-gray-800 p-4">
        {/* Tracking Toggles */}
        {running && (
          <div className="flex gap-2 items-center justify-center mb-3 flex-wrap">
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
        )}

        {/* Main Controls */}
        <div className="flex gap-3 items-center justify-center">
          <input
            ref={sourceInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleSourceUpload(e.target.files[0])}
          />
          <button
            onClick={() => sourceInputRef.current?.click()}
            className="px-4 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl transition-colors text-sm"
          >
            🎭 {sourceLabel}
          </button>

          <button
            onClick={() => setMuted(!muted)}
            className={`p-3 rounded-xl transition-colors ${muted ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-300'}`}
            title={muted ? 'Unmute' : 'Mute'}
          >
            {muted ? '🔇' : '🔊'}
          </button>

          <button
            onClick={() => setVideoOff(!videoOff)}
            className={`p-3 rounded-xl transition-colors ${videoOff ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-300'}`}
            title={videoOff ? 'Turn video on' : 'Turn video off'}
          >
            {videoOff ? '📷' : '📹'}
          </button>

          {!running ? (
            <button onClick={startCamera} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-colors">
              ▶ Join Call
            </button>
          ) : (
            <button onClick={stopCamera} className="px-6 py-3 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-xl transition-colors">
              ⏹ Leave
            </button>
          )}

          <button
            onClick={toggleCamera}
            className="p-3 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl transition-colors"
            title="Flip camera"
          >
            ↻
          </button>

          <button
            onClick={() => setMirror(!mirror)}
            className={`p-3 rounded-xl transition-colors ${mirror ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400'}`}
            title="Mirror"
          >
            ⇔
          </button>

          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-3 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl transition-colors"
            title="Settings"
          >
            ⚙
          </button>
        </div>

        {/* Status */}
        <div className="flex items-center justify-center gap-4 mt-3">
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
            status.type === 'ok' ? 'bg-emerald-600/60 text-emerald-300' :
            status.type === 'err' ? 'bg-red-600/60 text-red-300' :
            'bg-amber-600/60 text-amber-300'
          }`}>
            {status.text}
          </span>
          {ws.fps > 0 && running && (
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-600/60 text-emerald-300">
              {ws.fps} FPS
            </span>
          )}
          <span className="text-xs text-gray-600">
            {participants.length + 1} participants
          </span>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="absolute bottom-24 right-4 w-80 bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-3 z-20 shadow-2xl">
          <h3 className="font-semibold text-white">Call Settings</h3>
          <div>
            <label className="block text-sm text-gray-400 mb-2">Camera</label>
            <select
              value={facing}
              onChange={(e) => { setFacing(e.target.value as any); if (running) { stopCamera(); setTimeout(startCamera, 200); } }}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm"
            >
              <option value="user">Front Camera</option>
              <option value="environment">Rear Camera</option>
            </select>
          </div>
          <button
            onClick={() => setShowSettings(false)}
            className="w-full py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-sm transition-colors"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}
