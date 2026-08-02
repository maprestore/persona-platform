import { useRef, useCallback, useEffect, useState } from 'react';

interface TrackingData {
  head_pose?: { pitch: number; yaw: number; roll: number };
  expression?: {
    mouth_open: number;
    mouth_smile: number;
    eyebrow_raise: number;
    eye_open_left: number;
    eye_open_right: number;
  };
  left_hand?: { detected: boolean; gesture: string; landmarks?: any[] };
  right_hand?: { detected: boolean; gesture: string; landmarks?: any[] };
}

interface UseEngineWebSocketOptions {
  engineUrl?: string;
  onFrame?: (blob: Blob) => void;
  onTracking?: (data: TrackingData) => void;
  onError?: (msg: string) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

export function useEngineWebSocket(options: UseEngineWebSocketOptions = {}) {
  const {
    engineUrl = import.meta.env.VITE_ENGINE_URL || 'http://localhost:6967',
    onFrame,
    onTracking,
    onError,
    onConnect,
    onDisconnect,
  } = options;

  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [tracking, setTracking] = useState<TrackingData | null>(null);
  const [fps, setFps] = useState(0);
  const frameCountRef = useRef(0);
  const fpsIntervalRef = useRef<ReturnType<typeof setInterval>>();

  const getWsUrl = useCallback(() => {
    const url = new URL(engineUrl);
    const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${url.host}/stream`;
  }, [engineUrl]);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      const ws = new WebSocket(getWsUrl());
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        onConnect?.();
        fpsIntervalRef.current = setInterval(() => {
          setFps(frameCountRef.current);
          frameCountRef.current = 0;
        }, 1000);
      };

      ws.onmessage = (ev) => {
        if (typeof ev.data === 'string') {
          try {
            const msg = JSON.parse(ev.data);
            if (msg.tracking) {
              setTracking(msg.tracking);
              onTracking?.(msg.tracking);
            }
            if (msg.error) {
              onError?.(msg.error);
            }
          } catch (e) { /* ignore */ }
          return;
        }
        frameCountRef.current++;
        onFrame?.(ev.data);
      };

      ws.onerror = () => {
        onError?.('WebSocket error');
      };

      ws.onclose = () => {
        setConnected(false);
        setTracking(null);
        if (fpsIntervalRef.current) clearInterval(fpsIntervalRef.current);
        onDisconnect?.();
      };
    } catch (e) {
      onError?.('Failed to connect');
    }
  }, [getWsUrl, onFrame, onTracking, onError, onConnect, onDisconnect]);

  const disconnect = useCallback(() => {
    if (fpsIntervalRef.current) clearInterval(fpsIntervalRef.current);
    if (wsRef.current) {
      try { wsRef.current.close(); } catch (e) { /* */ }
      wsRef.current = null;
    }
    setConnected(false);
    setTracking(null);
  }, []);

  const sendFrame = useCallback((video: HTMLVideoElement, mirror: boolean = true) => {
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
    }, 'image/jpeg', 0.92);
  }, []);

  const toggleTracking = useCallback(async (type: string, enabled: boolean) => {
    const endpoint = type === 'tracking' ? '/tracking' : `/tracking/${type}`;
    try {
      await fetch(`${engineUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `enabled=${enabled}`,
      });
    } catch (e) {
      console.error('Tracking toggle failed:', e);
    }
  }, [engineUrl]);

  const uploadSourceFace = useCallback(async (file: File): Promise<string | null> => {
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`${engineUrl}/upload`, { method: 'POST', body: form });
      const data = await res.json();
      await fetch(`${engineUrl}/set-source`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `file_id=${encodeURIComponent(data.file_id)}`,
      });
      return data.file_id;
    } catch (e) {
      console.error('Upload source face failed:', e);
      return null;
    }
  }, [engineUrl]);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    connected,
    tracking,
    fps,
    connect,
    disconnect,
    sendFrame,
    toggleTracking,
    uploadSourceFace,
    ws: wsRef.current,
  };
}

export type { TrackingData };
