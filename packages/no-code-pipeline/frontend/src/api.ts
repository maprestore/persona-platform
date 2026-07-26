const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_BASE = isLocal ? 'http://localhost:6967' : '';

export const api = {
  async health() {
    const res = await fetch(`${API_BASE}/health`);
    return res.json();
  },

  async upload(file: File) {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${API_BASE}/upload`, { method: 'POST', body: form });
    return res.json();
  },

  async swap(sourceId: string, targetId: string, preserveVoice = true) {
    const res = await fetch(`${API_BASE}/swap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source_id: sourceId, target_id: targetId, preserve_voice: preserveVoice }),
    });
    return res.json();
  },

  getOutputUrl(outputId: string) {
    return `${API_BASE}/outputs/${outputId}`;
  },

  getFileUrl(fileId: string) {
    return `${API_BASE}/files/${fileId}`;
  },

  async listCameras() {
    try {
      const res = await fetch(`${API_BASE}/cameras`);
      return res.json();
    } catch {
      return { cameras: [] };
    }
  },

  async startVirtualCam(device: string, width: number, height: number, fps: number) {
    try {
      const res = await fetch(`${API_BASE}/virtual-cam/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device, width, height, fps }),
      });
      return res.json();
    } catch (e: any) {
      return { status: 'error', message: e.message };
    }
  },

  async stopVirtualCam() {
    try {
      const res = await fetch(`${API_BASE}/virtual-cam/stop`, { method: 'POST' });
      return res.json();
    } catch (e: any) {
      return { status: 'error', message: e.message };
    }
  },

  getStreamUrl() {
    const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    if (isLocal) return 'ws://localhost:6967/stream';
    return `${wsProto}//${window.location.host}/stream`;
  },
};
