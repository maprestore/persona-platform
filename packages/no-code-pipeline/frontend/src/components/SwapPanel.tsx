import React, { useRef } from 'react';
import { api } from '../api';

interface Props {
  sourceImage: string | null;
  targetImage: string | null;
  resultImage: string | null;
  sourceId: string | null;
  targetId: string | null;
  swapping: boolean;
  onSourceUpload: (url: string) => void;
  onTargetUpload: (url: string) => void;
  onSourceId: (id: string) => void;
  onTargetId: (id: string) => void;
  onSwap: () => void;
  onSourceFile: (file: File) => void;
  onTargetFile: (file: File) => void;
  use4k?: boolean;
  noWatermark?: boolean;
  onToggle4k?: () => void;
  onToggleWatermark?: () => void;
}

export default function SwapPanel({
  sourceImage, targetImage, resultImage, sourceId, targetId, swapping,
  onSourceUpload, onTargetUpload, onSourceId, onTargetId, onSwap,
  onSourceFile, onTargetFile, use4k, noWatermark, onToggle4k, onToggleWatermark,
}: Props) {
  const sourceRef = useRef<HTMLInputElement>(null);
  const targetRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File, type: 'source' | 'target') => {
    if (type === 'source') {
      onSourceFile(file);
    } else {
      onTargetFile(file);
    }
    try {
      const data = await api.upload(file);
      if (type === 'source') onSourceId(data.file_id);
      else onTargetId(data.file_id);
    } catch (e) {
      console.error('Upload failed:', e);
    }
  };

  return (
    <div className="flex flex-col gap-3 md:gap-4">
      <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Face Swap</h2>

      {/* Source & Target - Side by side on mobile */}
      <div className="grid grid-cols-2 gap-2 md:gap-3">
        {/* Source */}
        <div className="card p-2 md:p-3">
          <div className="flex items-center justify-between mb-1.5 md:mb-2">
            <span className="text-[10px] md:text-xs text-gray-500 font-medium uppercase tracking-wider">Source</span>
            {sourceId && <span className="badge-green text-[10px] md:text-xs">OK</span>}
          </div>
          <div
            onClick={() => sourceRef.current?.click()}
            className="bg-gray-800/50 rounded-lg h-24 md:h-32 flex items-center justify-center cursor-pointer border-2 border-dashed border-gray-700 hover:border-indigo-500/50 active:border-indigo-500 transition-all"
          >
            {sourceImage ? (
              <img src={sourceImage} alt="Source" className="w-full h-full object-contain rounded" />
            ) : (
              <div className="text-center">
                <svg className="w-6 h-6 md:w-8 md:h-8 mx-auto text-gray-600 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <span className="text-[10px] md:text-xs text-gray-500">Upload</span>
              </div>
            )}
          </div>
          <input ref={sourceRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0], 'source')} />
        </div>

        {/* Target */}
        <div className="card p-2 md:p-3">
          <div className="flex items-center justify-between mb-1.5 md:mb-2">
            <span className="text-[10px] md:text-xs text-gray-500 font-medium uppercase tracking-wider">Target</span>
            {targetId && <span className="badge-green text-[10px] md:text-xs">OK</span>}
          </div>
          <div
            onClick={() => targetRef.current?.click()}
            className="bg-gray-800/50 rounded-lg h-24 md:h-32 flex items-center justify-center cursor-pointer border-2 border-dashed border-gray-700 hover:border-indigo-500/50 active:border-indigo-500 transition-all"
          >
            {targetImage ? (
              <img src={targetImage} alt="Target" className="w-full h-full object-contain rounded" />
            ) : (
              <div className="text-center">
                <svg className="w-6 h-6 md:w-8 md:h-8 mx-auto text-gray-600 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <span className="text-[10px] md:text-xs text-gray-500">Upload</span>
              </div>
            )}
          </div>
          <input ref={targetRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0], 'target')} />
        </div>
      </div>

      {/* Options */}
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer">
          <input type="checkbox" checked={use4k} onChange={onToggle4k} className="accent-indigo-500" />
          4K HD
        </label>
        <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer">
          <input type="checkbox" checked={!noWatermark} onChange={onToggleWatermark} className="accent-indigo-500" />
          Watermark
        </label>
      </div>

      {/* Swap Button */}
      <button
        onClick={onSwap}
        disabled={!sourceId || !targetId || swapping}
        className={`btn-primary w-full py-2.5 md:py-3 text-sm font-semibold ${
          (!sourceId || !targetId || swapping) ? 'opacity-50 cursor-not-allowed' : ''
        }`}
      >
        {swapping ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Swapping...
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            Swap Faces
          </span>
        )}
      </button>

      {/* Result (shown below on mobile) */}
      {resultImage && (
        <div className="card p-2 md:p-3">
          <div className="flex items-center justify-between mb-1.5 md:mb-2">
            <span className="text-[10px] md:text-xs text-gray-500 font-medium uppercase tracking-wider">Result</span>
            <span className="badge-green text-[10px] md:text-xs">Done</span>
          </div>
          <img src={resultImage} alt="Result" className="w-full rounded-lg" />
          <a href={resultImage} download className="btn-secondary w-full mt-2 text-center text-xs py-1.5">
            Download
          </a>
        </div>
      )}
    </div>
  );
}
