import React, { useState, useCallback } from 'react';
import Header from './components/Header';
import VideoPreview from './components/VideoPreview';
import CameraPanel from './components/CameraPanel';
import SwapPanel from './components/SwapPanel';
import VirtualCamPanel from './components/VirtualCamPanel';
import SourcesPanel from './components/SourcesPanel';
import StatusBar from './components/StatusBar';
import LivePortraitPanel from './components/LivePortraitPanel';
import BackgroundPanel from './components/BackgroundPanel';
import FilterPanel from './components/FilterPanel';
import VoicePanel from './components/VoicePanel';
import TranslatePanel from './components/TranslatePanel';
import TuningPanel from './components/TuningPanel';
import { api } from './api';

export default function App() {
  const [serverStatus, setServerStatus] = useState<'connected' | 'disconnected'>('disconnected');
  const [activeTab, setActiveTab] = useState<string>('swap');
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

  const tabs = [
    { id: 'swap', label: 'Swap', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z', title: 'Face Swap' },
    { id: 'portrait', label: 'Portrait', icon: 'M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z', title: 'Live Portrait' },
    { id: 'background', label: 'Background', icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z', title: 'Background' },
    { id: 'filters', label: 'Filters', icon: 'M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01', title: 'Filters' },
    { id: 'voice', label: 'Voice', icon: 'M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z', title: 'Voice Changer' },
    { id: 'translate', label: 'Translate', icon: 'M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129', title: 'AI Translate' },
    { id: 'tuning', label: 'Tuning', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z', title: 'Advanced Tuning' },
    { id: 'sources', label: 'Sources', icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z', title: 'Sources' },
    { id: 'camera', label: 'Camera', icon: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z', title: 'Virtual Camera' },
  ];

  const tabComponents: Record<string, React.ReactNode> = {
    swap: (
      <div className="flex flex-col md:flex-row h-full">
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
        <div className="flex-1 p-3 md:p-4 min-h-[300px] md:min-h-0">
          <VideoPreview
            sourceImage={sourceImage}
            targetImage={targetImage}
            resultImage={resultImage}
          />
        </div>
        <div className="hidden lg:block w-80 border-l border-gray-800 p-4 overflow-y-auto">
          <VirtualCamPanel />
        </div>
      </div>
    ),
    portrait: <div className="p-3 md:p-4"><LivePortraitPanel /></div>,
    background: <div className="p-3 md:p-4"><BackgroundPanel /></div>,
    filters: <div className="p-3 md:p-4"><FilterPanel /></div>,
    voice: <div className="p-3 md:p-4"><VoicePanel /></div>,
    translate: <div className="p-3 md:p-4"><TranslatePanel /></div>,
    tuning: <div className="p-3 md:p-4"><TuningPanel /></div>,
    sources: (
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
    ),
    camera: <div className="p-3 md:p-4"><CameraPanel /></div>,
  };

  return (
    <div className="min-h-screen md:h-screen flex flex-col bg-gray-950">
      <Header serverStatus={serverStatus} onStatusChange={setServerStatus} />

      {/* Mobile Tab Bar */}
      <div className="md:hidden flex overflow-x-auto border-b border-gray-800 bg-gray-900/50 scrollbar-hide">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-shrink-0 flex flex-col items-center py-3 px-3 text-xs font-medium transition-colors ${
              activeTab === tab.id ? 'text-indigo-400 border-b-2 border-indigo-500' : 'text-gray-500'
            }`}
          >
            <svg className="w-4 h-4 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
            </svg>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Desktop Sidebar */}
        <div className="hidden md:flex w-16 bg-gray-900/50 border-r border-gray-800 flex-col items-center py-4 gap-1.5 overflow-y-auto">
          {tabs.map((tab) => (
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
          {tabComponents[activeTab] || tabComponents.swap}
        </div>
      </div>

      <StatusBar serverStatus={serverStatus} />
    </div>
  );
}
