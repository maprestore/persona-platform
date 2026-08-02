
import React, { useState } from 'react';
import { api } from '../api';

export default function TuningPanel() {
  const [params, setParams] = useState({
    face_align_strength: 1.0,
    blend_ratio: 0.7,
    color_correction: true,
    smoothness: 0.5,
    edge_feathering: 0.3,
    brightness_adapt: true,
    landmark_smoothing: true,
  });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (key: string, value: any) => {
    setParams((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const save = async () => {
    try {
      await api.setTuning(params);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save tuning');
    }
  };

  return (
    <div className="max-w-xl mx-auto flex flex-col gap-4">
      {error && <div role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</div>}
      <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Advanced Tuning</h2>
      <p className="text-xs text-gray-500">Fine-tune face swap quality and performance</p>

      <div className="card p-4 flex flex-col gap-4">
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Face Alignment Strength: {params.face_align_strength.toFixed(1)}</label>
          <input type="range" min="0" max="2" step="0.1" value={params.face_align_strength}
            onChange={(e) => update('face_align_strength', parseFloat(e.target.value))}
            className="w-full accent-indigo-500" />
          <div className="flex justify-between text-[10px] text-gray-600">
            <span>None</span><span>Full</span>
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-400 mb-1 block">Blend Ratio: {params.blend_ratio.toFixed(1)}</label>
          <input type="range" min="0" max="1" step="0.05" value={params.blend_ratio}
            onChange={(e) => update('blend_ratio', parseFloat(e.target.value))}
            className="w-full accent-indigo-500" />
          <div className="flex justify-between text-[10px] text-gray-600">
            <span>Source</span><span>Target</span>
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-400 mb-1 block">Smoothness: {params.smoothness.toFixed(1)}</label>
          <input type="range" min="0" max="1" step="0.05" value={params.smoothness}
            onChange={(e) => update('smoothness', parseFloat(e.target.value))}
            className="w-full accent-indigo-500" />
        </div>

        <div>
          <label className="text-xs text-gray-400 mb-1 block">Edge Feathering: {params.edge_feathering.toFixed(1)}</label>
          <input type="range" min="0" max="1" step="0.05" value={params.edge_feathering}
            onChange={(e) => update('edge_feathering', parseFloat(e.target.value))}
            className="w-full accent-indigo-500" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
            <input type="checkbox" checked={params.color_correction}
              onChange={(e) => update('color_correction', e.target.checked)}
              className="accent-indigo-500" />
            Color Correction
          </label>
          <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
            <input type="checkbox" checked={params.brightness_adapt}
              onChange={(e) => update('brightness_adapt', e.target.checked)}
              className="accent-indigo-500" />
            Brightness Adapt
          </label>
          <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
            <input type="checkbox" checked={params.landmark_smoothing}
              onChange={(e) => update('landmark_smoothing', e.target.checked)}
              className="accent-indigo-500" />
            Landmark Smoothing
          </label>
        </div>

        <button onClick={save}
          className={`btn-primary w-full py-2.5 text-sm ${saved ? 'bg-emerald-600' : ''}`}>
          {saved ? 'Saved!' : 'Apply Tuning'}
        </button>
      </div>

      {/* Presets */}
      <div className="card p-4">
        <div className="text-xs text-gray-500 font-medium mb-3 uppercase tracking-wider">Presets</div>
        <div className="grid grid-cols-3 gap-2">
          {[
            { name: 'Natural', p: { face_align_strength: 0.7, blend_ratio: 0.6, smoothness: 0.3, edge_feathering: 0.2, color_correction: true, brightness_adapt: true, landmark_smoothing: true } },
            { name: 'Smooth', p: { face_align_strength: 1.0, blend_ratio: 0.8, smoothness: 0.8, edge_feathering: 0.5, color_correction: true, brightness_adapt: true, landmark_smoothing: true } },
            { name: 'Sharp', p: { face_align_strength: 1.5, blend_ratio: 0.5, smoothness: 0.1, edge_feathering: 0.1, color_correction: false, brightness_adapt: false, landmark_smoothing: false } },
          ].map((preset) => (
            <button key={preset.name} onClick={() => { setParams(preset.p); setSaved(false); }}
              className="bg-gray-800/50 hover:bg-gray-700 rounded-lg p-2 text-center transition-all">
              <div className="text-xs font-medium text-gray-200">{preset.name}</div>
              <div className="text-[10px] text-gray-500">Quick preset</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
