import React, { useState, useRef, useCallback, useEffect } from 'react';
import api from '../api';
import { useAuth } from '../contexts/AuthContext';
import { useKeyboardShortcuts, SHORTCUTS } from '../hooks/useKeyboardShortcuts';

interface SwapType {
  id: string;
  name: string;
  credits: number;
  icon: string;
  description: string;
  color: string;
}

export default function SwapPage() {
  const { user, refreshUser } = useAuth();
  const [sourceImage, setSourceImage] = useState<File | null>(null);
  const [targetImage, setTargetImage] = useState<File | null>(null);
  const [sourcePreview, setSourcePreview] = useState<string | null>(null);
  const [targetPreview, setTargetPreview] = useState<string | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [swapType, setSwapType] = useState('face_swap');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState<'source' | 'target' | null>(null);
  const [showComparison, setShowComparison] = useState(false);
  const [sliderPos, setSliderPos] = useState(50);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const sliderRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const sourceRef = useRef<HTMLInputElement>(null);
  const targetRef = useRef<HTMLInputElement>(null);

  const swapTypes: SwapType[] = [
    { id: 'face_swap', name: 'Face Swap', credits: 1, icon: '🎭', description: 'Swap faces between two images', color: 'from-purple-500 to-pink-500' },
    { id: 'video_swap', name: 'Video Swap', credits: 5, icon: '🎬', description: 'Swap faces in video clips', color: 'from-blue-500 to-cyan-500' },
    { id: 'portrait', name: 'Live Portrait', credits: 3, icon: '🖼️', description: 'Animate static portraits', color: 'from-orange-500 to-red-500' },
    { id: 'background', name: 'Background', credits: 1, icon: '🎨', description: 'Remove or replace backgrounds', color: 'from-green-500 to-teal-500' },
    { id: 'filter', name: 'AI Filter', credits: 0.5, icon: '✨', description: 'Apply AI-powered filters', color: 'from-yellow-500 to-orange-500' },
    { id: 'voice', name: 'Voice Clone', credits: 2, icon: '🔊', description: 'Clone and modify voices', color: 'from-indigo-500 to-purple-500' },
  ];

  const selectedSwap = swapTypes.find(t => t.id === swapType);

  const handleFile = useCallback((file: File, type: 'source' | 'target') => {
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      setError('Please upload an image or video file');
      return;
    }
    
    if (file.size > 100 * 1024 * 1024) {
      setError('File size must be less than 100MB');
      return;
    }

    setError('');
    if (type === 'source') {
      setSourceImage(file);
      setSourcePreview(URL.createObjectURL(file));
    } else {
      setTargetImage(file);
      setTargetPreview(URL.createObjectURL(file));
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, type: 'source' | 'target') => {
    e.preventDefault();
    setDragOver(null);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file, type);
  }, [handleFile]);

  const handleSwap = async () => {
    if (!sourceImage) return;
    const needsTarget = swapType === 'face_swap' || swapType === 'video_swap';
    if (needsTarget && !targetImage) return;
    setLoading(true);
    setError('');
    setResultImage(null);

    try {
      // Upload source file
      const sourceForm = new FormData();
      sourceForm.append('file', sourceImage);
      const sourceRes = await api.post('/api/upload', sourceForm);
      const sourceId = sourceRes.data.file_id;

      let targetId = '';
      if (needsTarget && targetImage) {
        const targetForm = new FormData();
        targetForm.append('file', targetImage);
        const targetRes = await api.post('/api/upload', targetForm);
        targetId = targetRes.data.file_id;
      }

      // Perform swap
      const res = await api.post('/api/swap', {
        source_id: sourceId,
        target_id: targetId || sourceId,
        swap_type: swapType,
      });

      setResultImage(`/api/swap/${res.data.swap_id}/result?token=${localStorage.getItem('token') || ''}`);
      refreshUser();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Swap failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!resultImage) return;
    const link = document.createElement('a');
    link.href = resultImage;
    link.download = `persona-${swapType}-${Date.now()}.jpg`;
    link.click();
  };

  const handleClear = () => {
    setSourceImage(null);
    setTargetImage(null);
    setSourcePreview(null);
    setTargetPreview(null);
    setResultImage(null);
    setError('');
    setShowComparison(false);
    setSliderPos(50);
  };

  const handleSliderMove = useCallback((clientX: number) => {
    if (!sliderRef.current) return;
    const rect = sliderRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percent = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPos(percent);
  }, []);

  const handleSliderStart = useCallback(() => { isDragging.current = true; }, []);
  const handleSliderStop = useCallback(() => { isDragging.current = false; }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging.current) handleSliderMove(e.clientX);
    };
    const handleTouchMove = (e: TouchEvent) => {
      if (isDragging.current) handleSliderMove(e.touches[0].clientX);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleSliderStop);
    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleSliderStop);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleSliderStop);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleSliderStop);
    };
  }, [handleSliderMove, handleSliderStop]);

  useKeyboardShortcuts({
    onSearch: () => {},
    onUpload: () => sourceRef.current?.click(),
    onSubmit: handleSwap,
    onClose: () => { setShowComparison(false); setShowShortcuts(false); },
    onExport: handleDownload,
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">AI Studio</h1>
          <p className="text-gray-400 mt-1">Transform your content with AI magic</p>
        </div>
        <div className="flex items-center justify-center sm:justify-end gap-4">
          <button
            onClick={() => setShowShortcuts(true)}
            className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-xl text-gray-400 hover:text-white transition text-sm"
            title="Keyboard shortcuts"
          >
            ⌨️
          </button>
          <div className="flex items-center gap-2 px-4 py-2 bg-gray-800 rounded-xl">
            <span>💎</span>
            <span className="text-white font-medium">{user?.credits || 0}</span>
            <span className="text-gray-400 text-sm">credits</span>
          </div>
        </div>
      </div>

      {/* Swap Type Selection */}
      <div className="mb-8">
        <label className="block text-sm font-medium text-gray-300 mb-4">Select Transformation</label>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {swapTypes.map((type) => (
            <button
              key={type.id}
              onClick={() => setSwapType(type.id)}
              className={`p-4 rounded-xl border-2 transition-all text-left ${
                swapType === type.id
                  ? 'bg-gradient-to-br ' + type.color + ' border-transparent text-white shadow-lg'
                  : 'bg-gray-900 border-gray-800 text-gray-300 hover:border-gray-700'
              }`}
            >
              <span className="text-2xl block mb-2">{type.icon}</span>
              <p className="font-medium text-sm">{type.name}</p>
              <p className={`text-xs mt-1 ${swapType === type.id ? 'text-white/70' : 'text-gray-500'}`}>
                {type.credits} credit{type.credits !== 1 ? 's' : ''}
              </p>
            </button>
          ))}
        </div>
        
        {/* Selected Type Info */}
        {selectedSwap && (
          <div className="mt-4 p-4 bg-gray-900/50 rounded-xl border border-gray-800">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{selectedSwap.icon}</span>
              <div>
                <p className="text-white font-medium">{selectedSwap.name}</p>
                <p className="text-sm text-gray-400">{selectedSwap.description}</p>
              </div>
              <div className="ml-auto text-right">
                <p className="text-indigo-400 font-semibold">{selectedSwap.credits} credit</p>
                <p className="text-xs text-gray-500">≈ ${(selectedSwap.credits * 0.2).toFixed(2)}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Image Upload Areas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Source Image */}
        <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
          <div className="p-4 border-b border-gray-800">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-300">Source Face</h3>
              {sourcePreview && (
                <button
                  onClick={() => { setSourceImage(null); setSourcePreview(null); }}
                  className="text-xs text-gray-500 hover:text-red-400"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
          <div
            className={`aspect-square flex items-center justify-center transition-colors ${
              dragOver === 'source' ? 'bg-indigo-500/20' : 'bg-gray-800/50'
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragOver('source'); }}
            onDragLeave={() => setDragOver(null)}
            onDrop={(e) => handleDrop(e, 'source')}
          >
            {sourcePreview ? (
              <img src={sourcePreview} alt="Source" className="w-full h-full object-cover" />
            ) : (
              <label
                htmlFor="source-upload"
                className="cursor-pointer text-center p-6 w-full h-full flex flex-col items-center justify-center"
              >
                <div className="w-16 h-16 bg-gray-700 rounded-2xl flex items-center justify-center mb-4">
                  <span className="text-3xl">📷</span>
                </div>
                <p className="text-white font-medium mb-1">Upload Source</p>
                <p className="text-gray-500 text-sm">Drag & drop or click</p>
                <p className="text-gray-600 text-xs mt-2">JPG, PNG, WEBP (max 100MB)</p>
                <input
                  id="source-upload"
                  ref={sourceRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFile(file, 'source');
                  }}
                />
              </label>
            )}
          </div>
        </div>

        {/* Target Image */}
        <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
          <div className="p-4 border-b border-gray-800">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-300">Target Image</h3>
              {targetPreview && (
                <button
                  onClick={() => { setTargetImage(null); setTargetPreview(null); }}
                  className="text-xs text-gray-500 hover:text-red-400"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
          <div
            className={`aspect-square flex items-center justify-center transition-colors ${
              dragOver === 'target' ? 'bg-indigo-500/20' : 'bg-gray-800/50'
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragOver('target'); }}
            onDragLeave={() => setDragOver(null)}
            onDrop={(e) => handleDrop(e, 'target')}
          >
            {targetPreview ? (
              <img src={targetPreview} alt="Target" className="w-full h-full object-cover" />
            ) : (
              <label
                htmlFor="target-upload"
                className="cursor-pointer text-center p-6 w-full h-full flex flex-col items-center justify-center"
              >
                <div className="w-16 h-16 bg-gray-700 rounded-2xl flex items-center justify-center mb-4">
                  <span className="text-3xl">🖼️</span>
                </div>
                <p className="text-white font-medium mb-1">Upload Target</p>
                <p className="text-gray-500 text-sm">Drag & drop or click</p>
                <p className="text-gray-600 text-xs mt-2">JPG, PNG, WEBP (max 100MB)</p>
                <input
                  id="target-upload"
                  ref={targetRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFile(file, 'target');
                  }}
                />
              </label>
            )}
          </div>
        </div>

        {/* Result */}
        <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
          <div className="p-4 border-b border-gray-800">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-300">Result</h3>
              {resultImage && (
                <button
                  onClick={handleDownload}
                  className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                >
                  📥 Download
                </button>
              )}
            </div>
          </div>
          <div className="aspect-square bg-gray-800/50 flex items-center justify-center">
            {loading ? (
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-2 border-indigo-500 border-t-transparent mx-auto mb-4"></div>
                <p className="text-white font-medium">Processing...</p>
                <p className="text-gray-500 text-sm mt-1">AI is working its magic</p>
              </div>
            ) : resultImage ? (
              <div className="relative w-full h-full">
                {showComparison && sourcePreview ? (
                  <div
                    ref={sliderRef}
                    className="relative w-full h-full overflow-hidden cursor-col-resize select-none"
                    onMouseDown={handleSliderStart}
                    onTouchStart={handleSliderStart}
                  >
                    <img src={resultImage} alt="Result" className="absolute inset-0 w-full h-full object-cover" />
                    <div
                      className="absolute inset-0 overflow-hidden"
                      style={{ width: `${sliderPos}%` }}
                    >
                      <img
                        src={sourcePreview}
                        alt="Original"
                        className="absolute inset-0 w-full h-full object-cover"
                        style={{ width: sliderRef.current ? `${sliderRef.current.offsetWidth}px` : '100%' }}
                      />
                    </div>
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg z-10"
                      style={{ left: `${sliderPos}%` }}
                    >
                      <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center">
                        <span className="text-gray-800 text-xs font-bold">⇔</span>
                      </div>
                    </div>
                    <div className="absolute top-3 left-3 px-2 py-1 bg-black/60 rounded text-xs text-white">Original</div>
                    <div className="absolute top-3 right-3 px-2 py-1 bg-black/60 rounded text-xs text-white">Result</div>
                  </div>
                ) : (
                  <img src={resultImage} alt="Result" className="w-full h-full object-cover" />
                )}
                {sourcePreview && (
                  <button
                    onClick={() => setShowComparison(!showComparison)}
                    className={`absolute bottom-3 right-3 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      showComparison ? 'bg-indigo-600 text-white' : 'bg-black/60 text-white hover:bg-black/80'
                    }`}
                  >
                    {showComparison ? 'Hide Compare' : 'Compare'}
                  </button>
                )}
              </div>
            ) : (
              <div className="text-center p-6">
                <div className="w-16 h-16 bg-gray-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl">✨</span>
                </div>
                <p className="text-white font-medium">Result Preview</p>
                <p className="text-gray-500 text-sm mt-1">Upload images to start</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center gap-3">
          <span className="text-xl">⚠️</span>
          <p className="text-red-400">{error}</p>
          <button onClick={() => setError('')} className="ml-auto text-red-400 hover:text-red-300">
            ✕
          </button>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-4">
        <button
          onClick={handleSwap}
          disabled={!sourceImage || ((swapType === 'face_swap' || swapType === 'video_swap') && !targetImage) || loading || (user?.credits || 0) < (selectedSwap?.credits || 0)}
          className="flex-1 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-indigo-500/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
              Processing...
            </>
          ) : (
            <>
              <span className="text-xl">⚡</span>
              Transform ({selectedSwap?.credits} credits)
            </>
          )}
        </button>
        
        <button
          onClick={handleClear}
          disabled={loading}
          className="px-6 py-4 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-xl transition-colors disabled:opacity-50"
        >
          Clear All
        </button>
        
        {resultImage && (
          <button
            onClick={handleDownload}
            className="px-6 py-4 bg-green-600 hover:bg-green-500 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <span>📥</span>
            Download Result
          </button>
        )}
      </div>

      {/* Credits Warning */}
      {(user?.credits || 0) < (selectedSwap?.credits || 0) && (
        <div className="mt-6 bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl">⚠️</span>
            <p className="text-yellow-400">Insufficient credits for this transformation</p>
          </div>
          <a
            href="/app/credits"
            className="px-4 py-2 bg-yellow-500 hover:bg-yellow-400 text-black font-medium rounded-lg transition-colors text-sm"
          >
            Buy Credits
          </a>
        </div>
      )}

      {/* Tips */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-gray-900/50 rounded-xl border border-gray-800">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-xl">💡</span>
            <span className="text-white font-medium text-sm">Pro Tip</span>
          </div>
          <p className="text-gray-400 text-sm">Use high-quality, well-lit photos for best results. Clear faces work best for face swaps.</p>
        </div>
        <div className="p-4 bg-gray-900/50 rounded-xl border border-gray-800">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-xl">⚡</span>
            <span className="text-white font-medium text-sm">Speed</span>
          </div>
          <p className="text-gray-400 text-sm">Most transformations complete in under 30 seconds. Video may take 1-5 minutes.</p>
        </div>
        <div className="p-4 bg-gray-900/50 rounded-xl border border-gray-800">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-xl">🔒</span>
            <span className="text-white font-medium text-sm">Privacy</span>
          </div>
          <p className="text-gray-400 text-sm">Your files are encrypted and automatically deleted after 24 hours.</p>
        </div>
      </div>

      {/* Keyboard Shortcuts Modal */}
      {showShortcuts && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">⌨️ Keyboard Shortcuts</h2>
              <button onClick={() => setShowShortcuts(false)} className="text-gray-400 hover:text-white">✕</button>
            </div>
            <div className="space-y-2">
              {SHORTCUTS.map((s, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-gray-700/50 last:border-0">
                  <span className="text-gray-300 text-sm">{s.action}</span>
                  <div className="flex gap-1">
                    {s.keys.map((key, j) => (
                      <kbd key={j} className="px-2 py-1 bg-gray-900 border border-gray-600 rounded text-xs text-gray-300">
                        {key}
                      </kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
