const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_BASE = isLocal ? 'http://localhost:6967' : '';

type ApiInit = RequestInit & { json?: unknown };

async function request<T = any>(path: string, init: ApiInit = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  const response = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers: { ...(json === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers },
    body: json === undefined ? rest.body : JSON.stringify(json),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = payload && typeof payload === 'object' && 'detail' in payload
      ? String((payload as { detail: unknown }).detail)
      : `Request failed with status ${response.status}`;
    throw new Error(detail);
  }
  return payload as T;
}

export const api = {
  health: () => request<{ status: string }>('/health'),
  features: () => request<Record<string, boolean>>('/features'),

  async upload(file: File) {
    const form = new FormData();
    form.append('file', file);
    return request<{ file_id: string; filename: string; size: number }>('/upload', { method: 'POST', body: form });
  },

  swap: (sourceId: string, targetId: string, opts?: { preserveVoice?: boolean; use4k?: boolean; noWatermark?: boolean }) => request('/swap', {
    method: 'POST',
    json: {
      source_id: sourceId,
      target_id: targetId,
      preserve_voice: opts?.preserveVoice ?? true,
      use_4k: opts?.use4k ?? false,
      no_watermark: opts?.noWatermark ?? false,
    },
  }),
  swapVideo: (sourceId: string, targetId: string) => {
    const form = new FormData();
    form.append('source_id', sourceId);
    form.append('target_id', targetId);
    return request('/swap-video', { method: 'POST', body: form });
  },
  livePortrait: (sourceId: string, expression: string, intensity: number) => request('/live-portrait', { method: 'POST', json: { source_id: sourceId, expression, intensity } }),
  backgroundRemove: (fileId: string, opts?: { method?: string; bgColor?: string; bgFileId?: string; blurKernel?: number }) => request('/background-remove', { method: 'POST', json: { file_id: fileId, method: opts?.method ?? 'auto', bg_color: opts?.bgColor ?? null, bg_file_id: opts?.bgFileId ?? null, blur_kernel: opts?.blurKernel ?? 0 } }),
  applyFilter: (fileId: string, filterName: string, intensity = 1.0) => request('/apply-filter', { method: 'POST', json: { file_id: fileId, filter_name: filterName, intensity } }),
  listFilters: () => request<{ filters: string[] }>('/filters'),
  voiceCloneAdd: (name: string, fileId: string) => request('/voice-clone/add', { method: 'POST', json: { name, file_id: fileId } }),
  voiceCloneList: () => request<{ voices: string[] }>('/voice-clone/list'),
  voiceCloneConvert: (fileId: string, targetVoice?: string, pitchShift = 0) => request('/voice-clone/convert', { method: 'POST', json: { file_id: fileId, target_voice: targetVoice ?? null, pitch_shift: pitchShift } }),
  setTuning: (params: Record<string, unknown>) => request('/tuning', { method: 'POST', json: params }),
  translate: (fileId: string, sourceLang = 'en', targetLang = 'es') => request('/translate', { method: 'POST', json: { file_id: fileId, source_lang: sourceLang, target_lang: targetLang } }),
  toggleWatermark: (enabled: boolean) => {
    const form = new FormData();
    form.append('enabled', String(enabled));
    return request('/watermark', { method: 'POST', body: form });
  },
  listCameras: () => request<{ cameras: Array<{ device: string; name: string; type: string; driver?: string }> }>('/cameras'),
  startVirtualCam: (device: string, width: number, height: number, fps: number) => request('/virtual-cam/start', { method: 'POST', json: { device, width, height, fps } }),
  stopVirtualCam: () => request('/virtual-cam/stop', { method: 'POST' }),
  getOutputUrl: (outputId: string) => `${API_BASE}/outputs/${encodeURIComponent(outputId)}`,
  getFileUrl: (fileId: string) => `${API_BASE}/files/${encodeURIComponent(fileId)}`,
  getStreamUrl: () => {
    const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return isLocal ? 'ws://localhost:6967/stream' : `${wsProto}//${window.location.host}/stream`;
  },
};
