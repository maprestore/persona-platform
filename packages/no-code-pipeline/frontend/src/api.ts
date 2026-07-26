const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_BASE = isLocal ? 'http://localhost:6967' : '';

export const api = {
  async health() {
    const res = await fetch(`${API_BASE}/health`);
    return res.json();
  },

  async features() {
    const res = await fetch(`${API_BASE}/features`);
    return res.json();
  },

  async upload(file: File) {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${API_BASE}/upload`, { method: 'POST', body: form });
    return res.json();
  },

  async swap(sourceId: string, targetId: string, opts?: { preserveVoice?: boolean; use4k?: boolean; noWatermark?: boolean }) {
    const res = await fetch(`${API_BASE}/swap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source_id: sourceId,
        target_id: targetId,
        preserve_voice: opts?.preserveVoice ?? true,
        use_4k: opts?.use4k ?? false,
        no_watermark: opts?.noWatermark ?? false,
      }),
    });
    return res.json();
  },

  async swapVideo(sourceId: string, targetId: string) {
    const form = new FormData();
    form.append('source_id', sourceId);
    form.append('target_id', targetId);
    const res = await fetch(`${API_BASE}/swap-video`, { method: 'POST', body: form });
    return res.json();
  },

  async livePortrait(sourceId: string, expression: string, intensity: number) {
    const res = await fetch(`${API_BASE}/live-portrait`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source_id: sourceId, expression, intensity }),
    });
    return res.json();
  },

  async backgroundRemove(fileId: string, opts?: { method?: string; bgColor?: string; bgFileId?: string; blurKernel?: number }) {
    const res = await fetch(`${API_BASE}/background-remove`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        file_id: fileId,
        method: opts?.method ?? 'auto',
        bg_color: opts?.bgColor ?? null,
        bg_file_id: opts?.bgFileId ?? null,
        blur_kernel: opts?.blurKernel ?? 0,
      }),
    });
    return res.json();
  },

  async applyFilter(fileId: string, filterName: string, intensity: number = 1.0) {
    const res = await fetch(`${API_BASE}/apply-filter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_id: fileId, filter_name: filterName, intensity }),
    });
    return res.json();
  },

  async listFilters() {
    const res = await fetch(`${API_BASE}/filters`);
    return res.json();
  },

  async voiceCloneAdd(name: string, fileId: string) {
    const res = await fetch(`${API_BASE}/voice-clone/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, file_id: fileId }),
    });
    return res.json();
  },

  async voiceCloneList() {
    const res = await fetch(`${API_BASE}/voice-clone/list`);
    return res.json();
  },

  async voiceCloneConvert(fileId: string, targetVoice?: string, pitchShift: number = 0) {
    const res = await fetch(`${API_BASE}/voice-clone/convert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_id: fileId, target_voice: targetVoice ?? null, pitch_shift: pitchShift }),
    });
    return res.json();
  },

  async setTuning(params: Record<string, any>) {
    const res = await fetch(`${API_BASE}/tuning`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return res.json();
  },

  async translate(fileId: string, sourceLang: string = 'en', targetLang: string = 'es') {
    const res = await fetch(`${API_BASE}/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_id: fileId, source_lang: sourceLang, target_lang: targetLang }),
    });
    return res.json();
  },

  async toggleWatermark(enabled: boolean) {
    const form = new FormData();
    form.append('enabled', String(enabled));
    const res = await fetch(`${API_BASE}/watermark`, { method: 'POST', body: form });
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
