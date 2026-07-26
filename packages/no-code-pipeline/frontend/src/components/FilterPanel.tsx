import React, { useState, useRef, useEffect } from 'react';
import { api } from '../api';

const FILTER_ICONS: Record<string, string> = {
  none: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16',
  grayscale: 'M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01',
  sepia: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16',
  vintage: 'M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m0 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4',
  vibrant: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  cool: 'M20 12H4',
  warm: 'M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z',
  dramatic: 'M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707',
  cartoon: 'M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01',
  oil_paint: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12',
  sketch: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z',
  neon: 'M13 10V3L4 14h7v7l9-11h-7z',
  invert: 'M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707',
  blur: 'M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m0 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4',
  sharpen: 'M12 4v16m8-8H4',
  edge_detect: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z',
  emboss: 'M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5',
  pixelate: 'M4 5a1 1 0 011-1h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm6 6h4v4h-4v-4z',
  glitch: 'M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4',
};

export default function FilterPanel() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileId, setFileId] = useState<string | null>(null);
  const [selectedFilter, setSelectedFilter] = useState('none');
  const [intensity, setIntensity] = useState(1.0);
  const [processing, setProcessing] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [filters, setFilters] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.listFilters().then((data) => setFilters(data.filters || [])).catch(() => {});
  }, []);

  const handleFile = async (f: File) => {
    setFile(f);
    setPreview(URL.createObjectURL(f));
    const data = await api.upload(f);
    setFileId(data.file_id);
  };

  const apply = async () => {
    if (!fileId) return;
    setProcessing(true);
    try {
      const data = await api.applyFilter(fileId, selectedFilter, intensity);
      if (data.output_url) {
        setResultUrl(api.getOutputUrl(data.output_id));
      }
    } catch (e) {
      console.error('Filter failed:', e);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-4">
      <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Filters & Effects</h2>
      <p className="text-xs text-gray-500">Apply artistic filters and effects to your images</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-4">
          <div className="text-xs text-gray-500 font-medium mb-2 uppercase tracking-wider">Image</div>
          <div
            onClick={() => inputRef.current?.click()}
            className="bg-gray-800/50 rounded-lg h-40 flex items-center justify-center cursor-pointer border-2 border-dashed border-gray-700 hover:border-indigo-500/50"
          >
            {preview ? (
              <img src={preview} alt="Source" className="w-full h-full object-contain rounded" />
            ) : (
              <div className="text-center text-gray-600">
                <svg className="w-8 h-8 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12" />
                </svg>
                <span className="text-xs">Upload</span>
              </div>
            )}
          </div>
          <input ref={inputRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
        </div>

        <div className="card p-4 flex flex-col gap-3">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Intensity: {intensity.toFixed(1)}</label>
            <input type="range" min="0" max="2" step="0.1" value={intensity}
              onChange={(e) => setIntensity(parseFloat(e.target.value))}
              className="w-full accent-indigo-500" />
          </div>
          <button onClick={apply} disabled={!fileId || processing || selectedFilter === 'none'}
            className="btn-primary w-full py-2.5 text-sm mt-auto">
            {processing ? 'Applying...' : 'Apply Filter'}
          </button>
        </div>

        {resultUrl && (
          <div className="card p-4">
            <div className="text-xs text-gray-500 font-medium mb-2 uppercase tracking-wider">Result</div>
            <img src={resultUrl} alt="Result" className="w-full rounded-lg" />
            <a href={resultUrl} download className="btn-secondary w-full mt-2 text-center text-xs py-1.5 block">
              Download
            </a>
          </div>
        )}
      </div>

      {/* Filter Grid */}
      <div className="card p-4">
        <div className="text-xs text-gray-500 font-medium mb-3 uppercase tracking-wider">Choose Filter</div>
        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-2">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setSelectedFilter(f)}
              className={`p-2 rounded-lg text-center transition-all ${
                selectedFilter === f
                  ? 'bg-indigo-600 text-white ring-2 ring-indigo-400'
                  : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700 hover:text-gray-200'
              }`}
            >
              <svg className="w-5 h-5 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={FILTER_ICONS[f] || FILTER_ICONS.none} />
              </svg>
              <span className="text-[10px] font-medium capitalize">{f.replace('_', ' ')}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
