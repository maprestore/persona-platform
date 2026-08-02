
import React, { useState, useRef, useEffect } from 'react';
import { api } from '../api';

export default function VoicePanel() {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioId, setAudioId] = useState<string | null>(null);
  const [voices, setVoices] = useState<string[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>('');
  const [pitchShift, setPitchShift] = useState(0);
  const [mode, setMode] = useState<'convert' | 'clone'>('convert');
  const [processing, setProcessing] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [cloneName, setCloneName] = useState('');
  const [cloneFile, setCloneFile] = useState<File | null>(null);
  const [cloneFileId, setCloneFileId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLInputElement>(null);
  const cloneRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.voiceCloneList().then((data) => setVoices(data.voices || [])).catch((e) => setError(e instanceof Error ? e.message : 'Could not load data'));
  }, []);

  const handleAudioUpload = async (f: File) => {
    setAudioFile(f);
    let data;
    try {
      data = await api.upload(f);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
      return;
    }
    setAudioId(data.file_id);
  };

  const handleCloneUpload = async (f: File) => {
    setCloneFile(f);
    let data;
    try {
      data = await api.upload(f);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
      return;
    }
    setCloneFileId(data.file_id);
  };

  const addVoice = async () => {
    if (!cloneName || !cloneFileId) return;
    const data = await api.voiceCloneAdd(cloneName, cloneFileId);
    if (data.status === 'success') {
      setVoices([...voices, cloneName]);
      setSelectedVoice(cloneName);
      setCloneName('');
      setCloneFile(null);
      setCloneFileId(null);
    }
  };

  const convert = async () => {
    if (!audioId) return;
    setProcessing(true);
    try {
      const data = await api.voiceCloneConvert(audioId, mode === 'clone' ? selectedVoice : undefined, pitchShift);
      if (data.output_url) {
        setResultUrl(api.getOutputUrl(data.output_id));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Voice operation failed');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-4">
      {error && <div role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</div>}
      <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Voice Changer & Cloning</h2>
      <p className="text-xs text-gray-500">Real-time voice conversion and cloning</p>

      <div className="flex gap-1.5 mb-2">
        {(['convert', 'clone'] as const).map((m) => (
          <button key={m} onClick={() => setMode(m)}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
              mode === m ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}>
            {m === 'convert' ? 'Voice Changer' : 'Voice Cloning'}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-4 flex flex-col gap-3">
          <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">Input Audio</span>
          <div onClick={() => audioRef.current?.click()}
            className="bg-gray-800/50 rounded-lg h-24 flex items-center justify-center cursor-pointer border-2 border-dashed border-gray-700 hover:border-indigo-500/50">
            {audioFile ? (
              <div className="text-center">
                <svg className="w-6 h-6 mx-auto text-indigo-400 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
                <span className="text-xs text-gray-400">{audioFile.name}</span>
              </div>
            ) : (
              <div className="text-center text-gray-600">
                <svg className="w-8 h-8 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <span className="text-xs">Upload audio</span>
              </div>
            )}
          </div>
          <input ref={audioRef} type="file" accept="audio/*" className="hidden"
            onChange={(e) => e.target.files?.[0] && handleAudioUpload(e.target.files[0])} />

          <div>
            <label className="text-xs text-gray-400 mb-1 block">Pitch Shift: {pitchShift > 0 ? '+' : ''}{pitchShift} semitones</label>
            <input type="range" min="-12" max="12" step="1" value={pitchShift}
              onChange={(e) => setPitchShift(parseInt(e.target.value))}
              className="w-full accent-indigo-500" />
          </div>

          {mode === 'clone' && voices.length > 0 && (
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Target Voice</label>
              <select value={selectedVoice} onChange={(e) => setSelectedVoice(e.target.value)}
                className="select w-full text-sm">
                <option value="">Select voice...</option>
                {voices.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          )}

          <button onClick={convert} disabled={!audioId || processing}
            className="btn-primary w-full py-2.5 text-sm mt-auto">
            {processing ? 'Converting...' : mode === 'clone' ? 'Clone Voice' : 'Convert Voice'}
          </button>
        </div>

        <div className="card p-4 flex flex-col gap-3">
          {mode === 'clone' && (
            <>
              <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">Add Voice Sample</span>
              <div onClick={() => cloneRef.current?.click()}
                className="bg-gray-800/50 rounded-lg h-20 flex items-center justify-center cursor-pointer border-2 border-dashed border-gray-700 hover:border-indigo-500/50">
                {cloneFile ? (
                  <span className="text-xs text-gray-400">{cloneFile.name}</span>
                ) : (
                  <div className="text-center text-gray-600">
                    <svg className="w-6 h-6 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    <span className="text-xs">Upload voice sample</span>
                  </div>
                )}
              </div>
              <input ref={cloneRef} type="file" accept="audio/*" className="hidden"
                onChange={(e) => e.target.files?.[0] && handleCloneUpload(e.target.files[0])} />
              <input type="text" value={cloneName} onChange={(e) => setCloneName(e.target.value)}
                placeholder="Voice name..." className="input w-full text-sm" />
              <button onClick={addVoice} disabled={!cloneName || !cloneFileId}
                className="btn-secondary w-full py-2 text-sm">
                Add Voice
              </button>

              {voices.length > 0 && (
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Saved Voices</label>
                  <div className="flex flex-wrap gap-1">
                    {voices.map((v) => (
                      <span key={v} className="badge-green text-xs">{v}</span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {mode === 'convert' && (
            <div className="text-center text-gray-500 text-xs py-8">
              <svg className="w-10 h-10 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
              Upload audio and adjust pitch shift for real-time voice changing
            </div>
          )}
        </div>
      </div>

      {resultUrl && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">Result</span>
            <a href={resultUrl} download className="btn-secondary text-xs py-1 px-2">Download</a>
          </div>
          <audio src={resultUrl} controls className="w-full" />
        </div>
      )}
    </div>
  );
}
