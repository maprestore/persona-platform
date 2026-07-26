import React, { useState, useRef } from 'react';
import { api } from '../api';

export default function LivePortraitPanel() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileId, setFileId] = useState<string | null>(null);
  const [expression, setExpression] = useState('smile');
  const [intensity, setIntensity] = useState(1.0);
  const [processing, setProcessing] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (f: File) => {
    setFile(f);
    setPreview(URL.createObjectURL(f));
    const data = await api.upload(f);
    setFileId(data.file_id);
  };

  const animate = async () => {
    if (!fileId) return;
    setProcessing(true);
    try {
      const data = await api.livePortrait(fileId, expression, intensity);
      if (data.output_url) {
        setResultUrl(api.getOutputUrl(data.output_id));
      }
    } catch (e) {
      console.error('Live portrait failed:', e);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-4">
      <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Live Portrait</h2>
      <p className="text-xs text-gray-500">Animate a still portrait with AI-driven expressions</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-4">
          <div className="text-xs text-gray-500 font-medium mb-2 uppercase tracking-wider">Source Photo</div>
          <div
            onClick={() => inputRef.current?.click()}
            className="bg-gray-800/50 rounded-lg h-48 flex items-center justify-center cursor-pointer border-2 border-dashed border-gray-700 hover:border-indigo-500/50"
          >
            {preview ? (
              <img src={preview} alt="Source" className="w-full h-full object-contain rounded" />
            ) : (
              <div className="text-center text-gray-600">
                <svg className="w-10 h-10 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-xs">Upload a portrait photo</span>
              </div>
            )}
          </div>
          <input ref={inputRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
        </div>

        <div className="card p-4 flex flex-col gap-3">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Expression</label>
            <select value={expression} onChange={(e) => setExpression(e.target.value)} className="select w-full text-sm">
              <option value="smile">Smile</option>
              <option value="wink">Wink</option>
              <option value="head_turn">Head Turn</option>
              <option value="nod">Nod</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Intensity: {intensity.toFixed(1)}</label>
            <input type="range" min="0" max="2" step="0.1" value={intensity}
              onChange={(e) => setIntensity(parseFloat(e.target.value))}
              className="w-full accent-indigo-500" />
          </div>
          <button onClick={animate} disabled={!fileId || processing}
            className="btn-primary w-full py-2.5 text-sm mt-auto">
            {processing ? 'Animating...' : 'Animate'}
          </button>
        </div>
      </div>

      {resultUrl && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">Result</span>
            <a href={resultUrl} download className="btn-secondary text-xs py-1 px-2">Download</a>
          </div>
          <video src={resultUrl} controls className="w-full rounded-lg" />
        </div>
      )}
    </div>
  );
}
