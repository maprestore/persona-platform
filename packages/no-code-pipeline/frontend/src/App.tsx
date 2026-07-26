import React, { useState, useCallback } from 'react';
import Header from './components/Header';
import VideoPreview from './components/VideoPreview';
import CameraPanel from './components/CameraPanel';
import SwapPanel from './components/SwapPanel';
import VirtualCamPanel from './components/VirtualCamPanel';
import SourcesPanel from './components/SourcesPanel';
import StatusBar from './components/StatusBar';
import { api } from './api';

export default function App() {
  const [serverStatus, setServerStatus] = useState<'connected' | 'disconnected'>('disconnected');
  const [activeTab, setActiveTab] = useState<'swap' | 'camera' | 'sources'>('swap');
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [targetImage, setTargetImage] = useState<string | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [swapping, setSwapping] = useState(false);

  const handleSwap = useCallback(async () => {
    if (!sourceId || !targetId) return;
    setSwapping(true);
    try {
      const data = await api.swap(sourceId, targetId);
      if (data.output_url) {
        setResultImage(api.getOutputUrl(data.output_id));
      }
    } catch (e) {
      console.error('Swap failed:', e);
    } finally {
      setSwapping(false);
    }
  }, [sourceId, targetId]);

  return (
    <div className="min-h-screen md:h-screen flex flex-col bg-gray-950">
      <Header serverStatus={serverStatus} onStatusChange={setServerStatus} />

      {/* Mobile Tab Bar */}
      <div className="md:hidden flex border-b border-gray-800 bg-gray-900/50">
        {[
          { id: 'swap' as const, label: 'Swap', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
          { id: 'sources' as const, label: 'Sources', icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z' },
          { id: 'camera' as const, label: 'Camera', icon: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex flex-col items-center py-3 text-xs font-medium transition-colors ${
              activeTab === tab.id ? 'text-indigo-400 border-b-2 border-indigo-500' : 'text-gray-500'
            }`}
          >
            <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
            </svg>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Desktop Sidebar */}
        <div className="hidden md:flex w-16 bg-gray-900/50 border-r border-gray-800 flex-col items-center py-4 gap-2">
          {[
            { id: 'swap' as const, icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z', title: 'Face Swap' },
            { id: 'sources' as const, icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z', title: 'Sources' },
            { id: 'camera' as const, icon: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z', title: 'Virtual Camera' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
                activeTab === tab.id ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'
              }`}
              title={tab.title}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
              </svg>
            </button>
          ))}
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'swap' && (
            <div className="flex flex-col md:flex-row h-full">
              {/* Left: Source & Target */}
              <div className="w-full md:w-80 lg:w-96 border-b md:border-b-0 md:border-r border-gray-800 p-3 md:p-4 flex flex-col gap-3 md:gap-4 md:overflow-y-auto">
                <SwapPanel
                  sourceImage={sourceImage}
                  targetImage={targetImage}
                  resultImage={resultImage}
                  sourceId={sourceId}
                  targetId={targetId}
                  swapping={swapping}
                  onSourceUpload={setSourceImage}
                  onTargetUpload={setTargetImage}
                  onSourceId={setSourceId}
                  onTargetId={setTargetId}
                  onSwap={handleSwap}
                  onSourceFile={(f) => setSourceImage(URL.createObjectURL(f))}
                  onTargetFile={(f) => setTargetImage(URL.createObjectURL(f))}
                />
              </div>

              {/* Center: Preview */}
              <div className="flex-1 p-3 md:p-4 min-h-[300px] md:min-h-0">
                <VideoPreview
                  sourceImage={sourceImage}
                  targetImage={targetImage}
                  resultImage={resultImage}
                />
              </div>

              {/* Right: Virtual Cam (hidden on mobile, shown on lg) */}
              <div className="hidden lg:block w-80 border-l border-gray-800 p-4 overflow-y-auto">
                <VirtualCamPanel />
              </div>
            </div>
          )}

          {activeTab === 'sources' && (
            <div className="p-3 md:p-4">
              <SourcesPanel
                sourceImage={sourceImage}
                targetImage={targetImage}
                resultImage={resultImage}
                onSourceUpload={(file) => {
                  setSourceImage(URL.createObjectURL(file));
                  api.upload(file).then((d) => setSourceId(d.file_id));
                }}
                onTargetUpload={(file) => {
                  setTargetImage(URL.createObjectURL(file));
                  api.upload(file).then((d) => setTargetId(d.file_id));
                }}
              />
            </div>
          )}

          {activeTab === 'camera' && (
            <div className="p-3 md:p-4">
              <CameraPanel />
            </div>
          )}
        </div>
      </div>

      <StatusBar serverStatus={serverStatus} />
    </div>
  );
}
