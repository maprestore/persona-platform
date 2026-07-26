import React, { useRef } from 'react';

interface Props {
  sourceImage: string | null;
  targetImage: string | null;
  resultImage: string | null;
  onSourceUpload: (file: File) => void;
  onTargetUpload: (file: File) => void;
}

export default function SourcesPanel({ sourceImage, targetImage, resultImage, onSourceUpload, onTargetUpload }: Props) {
  const sourceRef = useRef<HTMLInputElement>(null);
  const targetRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col gap-3 md:gap-4">
      <h2 className="text-xs md:text-sm font-semibold text-gray-300 uppercase tracking-wider">Source Manager</h2>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
        {/* Source */}
        <div className="card p-3 md:p-4 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">Source Face</span>
            <button onClick={() => sourceRef.current?.click()} className="btn-secondary text-xs py-1 px-2">
              Upload
            </button>
          </div>
          <input ref={sourceRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => e.target.files?.[0] && onSourceUpload(e.target.files[0])} />
          <div className="flex-1 bg-gray-800/50 rounded-lg flex items-center justify-center min-h-[120px] md:min-h-[180px]">
            {sourceImage ? (
              <img src={sourceImage} alt="Source" className="w-full h-full object-contain rounded" />
            ) : (
              <div className="text-center text-gray-600">
                <svg className="w-8 h-8 md:w-10 md:h-10 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span className="text-xs">Drop or click</span>
              </div>
            )}
          </div>
          <div className="mt-2 text-[10px] md:text-xs text-gray-500 text-center">
            The face to apply
          </div>
        </div>

        {/* Target */}
        <div className="card p-3 md:p-4 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">Target Image</span>
            <button onClick={() => targetRef.current?.click()} className="btn-secondary text-xs py-1 px-2">
              Upload
            </button>
          </div>
          <input ref={targetRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => e.target.files?.[0] && onTargetUpload(e.target.files[0])} />
          <div className="flex-1 bg-gray-800/50 rounded-lg flex items-center justify-center min-h-[120px] md:min-h-[180px]">
            {targetImage ? (
              <img src={targetImage} alt="Target" className="w-full h-full object-contain rounded" />
            ) : (
              <div className="text-center text-gray-600">
                <svg className="w-8 h-8 md:w-10 md:h-10 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-xs">Drop or click</span>
              </div>
            )}
          </div>
          <div className="mt-2 text-[10px] md:text-xs text-gray-500 text-center">
            The image to put face on
          </div>
        </div>

        {/* Result */}
        <div className="card p-3 md:p-4 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">Result</span>
            {resultImage && (
              <a href={resultImage} download className="btn-secondary text-xs py-1 px-2">
                Save
              </a>
            )}
          </div>
          <div className="flex-1 bg-gray-800/50 rounded-lg flex items-center justify-center min-h-[120px] md:min-h-[180px]">
            {resultImage ? (
              <img src={resultImage} alt="Result" className="w-full h-full object-contain rounded" />
            ) : (
              <div className="text-center text-gray-600">
                <svg className="w-8 h-8 md:w-10 md:h-10 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-xs">No result yet</span>
              </div>
            )}
          </div>
          <div className="mt-2 text-[10px] md:text-xs text-gray-500 text-center">
            Swapped output
          </div>
        </div>
      </div>

      {/* How to use - Steps */}
      <div className="card p-3 md:p-4">
        <h3 className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-2">How to use</h3>
        <div className="flex flex-wrap justify-center gap-4 md:gap-6 text-xs text-gray-400">
          {[
            { num: '1', text: 'Upload source face' },
            { num: '2', text: 'Upload target' },
            { num: '3', text: 'Click Swap' },
            { num: '4', text: 'Use with virtual cam' },
          ].map((step) => (
            <div key={step.num} className="text-center">
              <div className="w-7 h-7 md:w-8 md:h-8 bg-indigo-600/20 rounded-full flex items-center justify-center mx-auto mb-1">
                <span className="text-indigo-400 font-bold text-xs md:text-sm">{step.num}</span>
              </div>
              {step.text}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
