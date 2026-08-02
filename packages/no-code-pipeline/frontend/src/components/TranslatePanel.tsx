
import React, { useState, useRef } from 'react';
import { api } from '../api';

const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ru', name: 'Russian' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'zh', name: 'Chinese' },
  { code: 'ar', name: 'Arabic' },
  { code: 'hi', name: 'Hindi' },
];

export default function TranslatePanel() {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioId, setAudioId] = useState<string | null>(null);
  const [sourceLang, setSourceLang] = useState('en');
  const [targetLang, setTargetLang] = useState('es');
  const [processing, setProcessing] = useState(false);
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLInputElement>(null);

  const handleFile = async (f: File) => {
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

  const translate = async () => {
    if (!audioId) return;
    setProcessing(true);
    try {
      const data = await api.translate(audioId, sourceLang, targetLang);
      setTranslatedText(data.translated_text);
      if (data.output_audio_url) {
        setResultUrl(api.getOutputUrl(data.output_audio_id));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Translation failed');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-4">
      {error && <div role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</div>}
      <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">AI Video Translator</h2>
      <p className="text-xs text-gray-500">Translate audio and video with AI-powered dubbing</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-4 flex flex-col gap-3">
          <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">Source Audio</span>
          <div onClick={() => audioRef.current?.click()}
            className="bg-gray-800/50 rounded-lg h-32 flex items-center justify-center cursor-pointer border-2 border-dashed border-gray-700 hover:border-indigo-500/50">
            {audioFile ? (
              <div className="text-center">
                <svg className="w-8 h-8 mx-auto text-indigo-400 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
                <span className="text-xs text-gray-400">{audioFile.name}</span>
              </div>
            ) : (
              <div className="text-center text-gray-600">
                <svg className="w-10 h-10 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
                <span className="text-xs">Upload audio file</span>
              </div>
            )}
          </div>
          <input ref={audioRef} type="file" accept="audio/*" className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
        </div>

        <div className="card p-4 flex flex-col gap-3">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Source Language</label>
            <select value={sourceLang} onChange={(e) => setSourceLang(e.target.value)} className="select w-full text-sm">
              {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
            </select>
          </div>
          <div className="flex justify-center">
            <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Target Language</label>
            <select value={targetLang} onChange={(e) => setTargetLang(e.target.value)} className="select w-full text-sm">
              {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
            </select>
          </div>
          <button onClick={translate} disabled={!audioId || processing}
            className="btn-primary w-full py-2.5 text-sm mt-auto">
            {processing ? 'Translating...' : 'Translate & Dub'}
          </button>
        </div>
      </div>

      {translatedText && (
        <div className="card p-4">
          <div className="text-xs text-gray-500 font-medium mb-2 uppercase tracking-wider">Translated Text</div>
          <p className="text-sm text-gray-200 bg-gray-800/50 rounded-lg p-3">{translatedText}</p>
        </div>
      )}

      {resultUrl && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">Dubbed Audio</span>
            <a href={resultUrl} download className="btn-secondary text-xs py-1 px-2">Download</a>
          </div>
          <audio src={resultUrl} controls className="w-full" />
        </div>
      )}
    </div>
  );
}
