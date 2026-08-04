import React, { useState, useRef, useCallback, useEffect } from 'react';

const ENGINE_URL = import.meta.env.VITE_ENGINE_URL || 'http://localhost:6967';

interface Participant {
  user_id: string;
  name: string;
  muted: boolean;
  video_off: boolean;
  canvasRef?: React.RefObject<HTMLCanvasElement>;
}

interface RoomInfo {
  room_id: string;
  name: string;
  participants: Participant[];
  max_participants: number;
}

export default function VideoCallPage() {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number>();
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const remoteCanvasRefs = useRef<Map<string, HTMLCanvasElement>>(new Map());

  const [phase, setPhase] = useState<'lobby' | 'calling'>('lobby');
  const [roomName, setRoomName] = useState('');
  const [joinRoomId, setJoinRoomId] = useState('');
  const [currentRoom, setCurrentRoom] = useState<RoomInfo | null>(null);
  const [userName, setUserName] = useState(`User-${Math.random().toString(36).slice(2, 6)}`);
  const [status, setStatus] = useState({ text: 'Ready', type: 'warn' as 'ok' | 'warn' | 'err' });
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [sourceFaceId, setSourceFaceId] = useState<string | null>(null);
  const [sourceLabel, setSourceLabel] = useState('+ Face');
  const sourceInputRef = useRef<HTMLInputElement>(null);
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [mirror, setMirror] = useState(true);
  const [facing, setFacing] = useState<'user' | 'environment'>('user');
  const [fps, setFps] = useState(0);
  const [chatMessages, setChatMessages] = useState<{from: string; name: string; message: string}[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [showChat, setShowChat] = useState(false);
  const frameCountRef = useRef(0);

  const getWsUrl = useCallback((roomId: string) => {
    const url = new URL(ENGINE_URL);
    const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${url.host}/room/${roomId}/stream`;
  }, []);

  const createRoom = useCallback(async () => {
    try {
      const form = new FormData();
      form.append('name', roomName || 'Video Call');
      form.append('max_participants', '8');
      const res = await fetch(`${ENGINE_URL}/rooms`, { method: 'POST', body: form });
      const data = await res.json();
      setJoinRoomId(data.room_id);
      joinRoom(data.room_id);
    } catch (e: any) {
      setStatus({ text: `Failed to create room: ${e.message}`, type: 'err' });
    }
  }, [roomName]);

  const joinRoom = useCallback(async (roomId: string) => {
    if (!roomId.trim()) return;
    setStatus({ text: 'Connecting...', type: 'warn' });

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
      streamRef.current = stream;
      audioStreamRef.current = stream;

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        await localVideoRef.current.play();
      }

      // Setup audio context for sending
      audioContextRef.current = new AudioContext();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      const processor = audioContextRef.current.createScriptProcessor(1024, 1, 1);
      processor.onaudioprocess = (e) => {
        if (wsRef.current?.readyState !== WebSocket.OPEN) return;
        const audioData = e.inputBuffer.getChannelData(0);
        const base64 = btoa(String.fromCharCode(...new Uint8Array(audioData.buffer)));
        wsRef.current.send(JSON.stringify({ type: 'audio', data: base64 }));
      };
      source.connect(processor);
      processor.connect(audioContextRef.current.destination);

      // Connect WebSocket
      const ws = new WebSocket(getWsUrl(roomId));
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ user_id: userName, name: userName }));
        setPhase('calling');
        setStatus({ text: 'Connected', type: 'ok' });

        // FPS counter
        const fpsInterval = setInterval(() => {
          setFps(frameCountRef.current);
          frameCountRef.current = 0;
        }, 1000);

        ws.onclose = () => clearInterval(fpsInterval);
      };

      ws.onmessage = (ev) => {
        if (typeof ev.data === 'string') {
          try {
            const msg = JSON.parse(ev.data);
            handleRoomMessage(msg);
          } catch (e) { /* ignore */ }
          return;
        }

        // Binary = video frame from another participant
        frameCountRef.current++;
        renderRemoteFrame(ev.data);
      };

      ws.onerror = () => {
        setStatus({ text: 'Connection error', type: 'err' });
      };

      ws.onclose = () => {
        setStatus({ text: 'Disconnected', type: 'warn' });
        setPhase('lobby');
        setCurrentRoom(null);
        setParticipants([]);
      };

      // Start sending frames
      const loop = () => {
        if (!localVideoRef.current?.srcObject || ws.readyState !== WebSocket.OPEN) {
          animFrameRef.current = requestAnimationFrame(loop);
          return;
        }
        sendFrame(localVideoRef.current, mirror);
        animFrameRef.current = requestAnimationFrame(loop);
      };
      animFrameRef.current = requestAnimationFrame(loop);

    } catch (e: any) {
      setStatus({ text: `Camera error: ${e.message}`, type: 'err' });
    }
  }, [facing, mirror, userName, getWsUrl]);

  const handleRoomMessage = useCallback((msg: any) => {
    if (msg.type === 'room_info') {
      setCurrentRoom({
        room_id: msg.room_id,
        name: msg.room_id,
        participants: msg.participants,
        max_participants: 8,
      });
      setParticipants(msg.participants.filter((p: Participant) => p.user_id !== userName));
    }

    if (msg.type === 'participant_joined') {
      setParticipants(prev => [...prev, { user_id: msg.user_id, name: msg.name, muted: false, video_off: false }]);
      setChatMessages(prev => [...prev, { from: 'system', name: 'System', message: `${msg.name} joined` }]);
    }

    if (msg.type === 'participant_left') {
      setParticipants(prev => prev.filter(p => p.user_id !== msg.user_id));
      setChatMessages(prev => [...prev, { from: 'system', name: 'System', message: `Participant left` }]);
      // Clean up canvas
      remoteCanvasRefs.current.delete(msg.user_id);
    }

    if (msg.type === 'participant_updated') {
      setParticipants(prev => prev.map(p =>
        p.user_id === msg.user_id ? { ...p, muted: msg.muted, video_off: msg.video_off } : p
      ));
    }

    if (msg.type === 'chat') {
      setChatMessages(prev => [...prev, { from: msg.from, name: msg.name, message: msg.message }]);
    }

    if (msg.tracking) {
      // Could render tracking overlay on remote participant
    }
  }, [userName]);

  const renderRemoteFrame = useCallback((blob: Blob) => {
    // For simplicity, render the latest remote frame to a shared canvas
    // In production, you'd route frames by participant ID
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      // Find first available remote canvas
      const canvasEntries = Array.from(remoteCanvasRefs.current.entries());
      if (canvasEntries.length > 0) {
        const [id, canvas] = canvasEntries[0];
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        canvas.classList.remove('hidden');
      }
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }, []);

  const sendFrame = useCallback((video: HTMLVideoElement, mirror: boolean) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN || !video.videoWidth) return;

    const canvas = document.createElement('canvas');
    const maxW = 1280, maxH = 720;
    const scale = Math.min(maxW / video.videoWidth, maxH / video.videoHeight, 1);
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext('2d')!;
    if (mirror) {
      ctx.save();
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      ctx.restore();
    } else {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    }
    canvas.toBlob((blob) => {
      if (blob && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(blob);
      }
    }, 'image/jpeg', 0.85);
  }, []);

  const sendChat = useCallback(() => {
    if (!chatInput.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: 'chat', message: chatInput }));
    setChatMessages(prev => [...prev, { from: userName, name: userName, message: chatInput }]);
    setChatInput('');
  }, [chatInput, userName]);

  const toggleMute = useCallback(() => {
    const newMuted = !muted;
    setMuted(newMuted);
    if (audioStreamRef.current) {
      audioStreamRef.current.getAudioTracks().forEach(t => { t.enabled = !newMuted; });
    }
    wsRef.current?.send(JSON.stringify({ type: 'control', muted: newMuted, video_off: videoOff }));
  }, [muted, videoOff]);

  const toggleVideo = useCallback(() => {
    const newVideoOff = !videoOff;
    setVideoOff(newVideoOff);
    if (streamRef.current) {
      streamRef.current.getVideoTracks().forEach(t => { t.enabled = !newVideoOff; });
    }
    wsRef.current?.send(JSON.stringify({ type: 'control', muted, video_off: newVideoOff }));
  }, [videoOff, muted]);

  const leaveRoom = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    if (audioContextRef.current) { audioContextRef.current.close(); audioContextRef.current = null; }
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    remoteCanvasRefs.current.clear();
    setPhase('lobby');
    setCurrentRoom(null);
    setParticipants([]);
    setStatus({ text: 'Left call', type: 'warn' });
  }, []);

  const handleSourceUpload = useCallback(async (file: File) => {
    setSourceLabel('Uploading...');
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`${ENGINE_URL}/upload`, { method: 'POST', body: form });
      const data = await res.json();
      await fetch(`${ENGINE_URL}/set-source`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `file_id=${encodeURIComponent(data.file_id)}`,
      });
      setSourceFaceId(data.file_id);
      setSourceLabel(`✓ ${file.name}`);
    } catch (e) {
      setSourceLabel('Failed');
    }
  }, []);

  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (wsRef.current) wsRef.current.close();
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      if (audioContextRef.current) audioContextRef.current.close();
    };
  }, []);

  // ── Lobby Phase ────────────────────────────────────────────────────
  if (phase === 'lobby') {
    return (
      <div className="h-full flex items-center justify-center bg-gray-950 p-4">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold text-white">Video Call</h1>
            <p className="text-gray-400">Create or join a room with face-swap processing</p>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Your Name</label>
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-indigo-500"
                placeholder="Enter your name"
              />
            </div>

            <div className="border-t border-gray-800 pt-4">
              <h3 className="text-sm font-semibold text-gray-300 mb-3">Create New Room</h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-indigo-500"
                  placeholder="Room name (optional)"
                />
                <button
                  onClick={createRoom}
                  className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-colors"
                >
                  Create
                </button>
              </div>
            </div>

            <div className="border-t border-gray-800 pt-4">
              <h3 className="text-sm font-semibold text-gray-300 mb-3">Join Existing Room</h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={joinRoomId}
                  onChange={(e) => setJoinRoomId(e.target.value)}
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-indigo-500"
                  placeholder="Room ID"
                />
                <button
                  onClick={() => joinRoom(joinRoomId)}
                  disabled={!joinRoomId.trim()}
                  className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold rounded-xl transition-colors"
                >
                  Join
                </button>
              </div>
            </div>

            {/* Source Face Upload */}
            <div className="border-t border-gray-800 pt-4">
              <h3 className="text-sm font-semibold text-gray-300 mb-3">Source Face (for face-swap)</h3>
              <input
                ref={sourceInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleSourceUpload(e.target.files[0])}
              />
              <button
                onClick={() => sourceInputRef.current?.click()}
                className="w-full px-4 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-sm transition-colors"
              >
                🎭 {sourceLabel}
              </button>
              <p className="text-xs text-gray-600 mt-2">Upload a face photo to apply face-swap to all participants</p>
            </div>
          </div>

          <div className="text-center">
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
              status.type === 'ok' ? 'bg-emerald-600/60 text-emerald-300' :
              status.type === 'err' ? 'bg-red-600/60 text-red-300' :
              'bg-amber-600/60 text-amber-300'
            }`}>
              {status.text}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // ── Call Phase ─────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col bg-gray-950">
      {/* Room Info Bar */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-white">Room: {currentRoom?.room_id || joinRoomId}</span>
          <button
            onClick={() => navigator.clipboard.writeText(currentRoom?.room_id || joinRoomId)}
            className="px-2 py-1 bg-gray-800 hover:bg-gray-700 text-gray-400 rounded text-xs transition-colors"
          >
            Copy ID
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">{participants.length + 1} participants</span>
          {fps > 0 && (
            <span className="px-2 py-1 bg-emerald-600/60 text-emerald-300 rounded text-xs">{fps} FPS</span>
          )}
        </div>
      </div>

      {/* Video Grid */}
      <div className="flex-1 p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-fr min-h-0">
        {/* Local Video */}
        <div className="relative bg-black rounded-2xl overflow-hidden border border-gray-800">
          <video ref={localVideoRef} autoPlay playsInline muted className="hidden" />
          <canvas ref={localCanvasRef} className="w-full h-full object-contain" />
          <div className="absolute bottom-3 left-3">
            <span className="px-3 py-1 bg-black/60 backdrop-blur-xl rounded-full text-xs text-white font-medium">
              You ({userName})
            </span>
          </div>
          {sourceFaceId && (
            <div className="absolute top-3 left-3">
              <span className="px-2 py-1 bg-emerald-600/60 backdrop-blur-xl rounded-full text-[10px] text-emerald-200">
                🎭 Face Swap Active
              </span>
            </div>
          )}
        </div>

        {/* Remote Participants */}
        {participants.map((p) => (
          <div key={p.user_id} className="relative bg-gray-900 rounded-2xl overflow-hidden border border-gray-800">
            <canvas
              ref={(el) => {
                if (el) {
                  remoteCanvasRefs.current.set(p.user_id, { current: el } as any);
                  el.className = 'w-full h-full object-contain';
                }
              }}
              className="w-full h-full object-contain"
            />
            {p.video_off && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center text-2xl text-gray-600">
                  👤
                </div>
              </div>
            )}
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
              <span className="px-3 py-1 bg-black/60 backdrop-blur-xl rounded-full text-xs text-white font-medium">
                {p.name}
              </span>
              <div className="flex gap-1">
                {p.muted && (
                  <span className="px-2 py-1 bg-red-600/60 rounded-full text-[10px] text-red-200">🔇</span>
                )}
                {p.video_off && (
                  <span className="px-2 py-1 bg-red-600/60 rounded-full text-[10px] text-red-200">📷</span>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* Empty slots */}
        {Array.from({ length: Math.max(0, 3 - participants.length) }).map((_, i) => (
          <div key={`empty-${i}`} className="relative bg-gray-900 rounded-2xl overflow-hidden border border-gray-800 border-dashed flex items-center justify-center">
            <div className="text-center space-y-3">
              <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto text-2xl text-gray-600">
                👤
              </div>
              <p className="text-sm text-gray-600">Waiting for participant...</p>
            </div>
          </div>
        ))}
      </div>

      {/* Controls Bar */}
      <div className="bg-gradient-to-t from-gray-900 via-gray-900/95 to-gray-900/85 border-t border-gray-800 p-4">
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
            onClick={toggleMute}
            className={`p-3 rounded-xl transition-colors ${muted ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-300'}`}
            title={muted ? 'Unmute' : 'Mute'}
          >
            {muted ? '🔇' : '🔊'}
          </button>

          <button
            onClick={toggleVideo}
            className={`p-3 rounded-xl transition-colors ${videoOff ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-300'}`}
            title={videoOff ? 'Turn video on' : 'Turn video off'}
          >
            {videoOff ? '📷' : '📹'}
          </button>

          <button
            onClick={() => setMirror(!mirror)}
            className={`p-3 rounded-xl transition-colors ${mirror ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400'}`}
            title="Mirror"
          >
            ⇔
          </button>

          <button
            onClick={() => setShowChat(!showChat)}
            className={`p-3 rounded-xl transition-colors ${showChat ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-300'}`}
            title="Chat"
          >
            💬
          </button>

          <button
            onClick={() => {
              const newFacing = facing === 'user' ? 'environment' : 'user';
              setFacing(newFacing);
              leaveRoom();
              setTimeout(() => joinRoom(joinRoomId), 200);
            }}
            className="p-3 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl transition-colors"
            title="Flip camera"
          >
            ↻
          </button>

          <button
            onClick={leaveRoom}
            className="px-6 py-3 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-xl transition-colors"
          >
            ⏹ Leave
          </button>
        </div>
      </div>

      {/* Chat Panel */}
      {showChat && (
        <div className="absolute bottom-24 right-4 w-80 bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden z-20 shadow-2xl">
          <div className="p-3 border-b border-gray-800 flex items-center justify-between">
            <h3 className="font-semibold text-white text-sm">Chat</h3>
            <button onClick={() => setShowChat(false)} className="text-gray-500 hover:text-gray-300">✕</button>
          </div>
          <div className="h-64 overflow-y-auto p-3 space-y-2">
            {chatMessages.map((msg, i) => (
              <div key={i} className={`text-sm ${msg.from === 'system' ? 'text-gray-500 italic' : ''}`}>
                {msg.from !== 'system' && <span className="font-semibold text-indigo-400">{msg.name}: </span>}
                <span className="text-gray-300">{msg.message}</span>
              </div>
            ))}
          </div>
          <div className="p-3 border-t border-gray-800 flex gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendChat()}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
              placeholder="Type a message..."
            />
            <button
              onClick={sendChat}
              className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm transition-colors"
            >
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
