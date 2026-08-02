
import React from 'react';

interface Props {
  sourceImage: string | null;
  targetImage: string | null;
  resultImage: string | null;
}

export default function VideoPreview({ sourceImage, targetImage, resultImage }: Props) {
  return (
    <div className="h-full flex flex-col gap-3 md:gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xs md:text-sm font-semibold text-gray-300 uppercase tracking-wider">Preview</h2>
        <span className="badge-blue text-[10px] md:text-xs">Live</span>
      </div>

      {/* Result - Primary on mobile */}
      <div className="card p-2 md:p-3 flex-1 min-h-0">
        <div className="text-[10px] md:text-xs text-gray-500 font-medium mb-1.5 md:mb-2 uppercase tracking-wider">Result</div>
        <div className="bg-gray-800/50 rounded-lg h-40 md:h-full min-h-[160px] flex items-center justify-center">
          {resultImage ? (
            <img src={resultImage} alt="Result" className="w-full h-full object-contain" />
          ) : (
            <div className="text-center text-gray-600">
              <svg className="w-10 h-10 md:w-12 md:h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-xs md:text-sm">Swap to see result</span>
            </div>
          )}
        </div>
      </div>

      {/* Source & Target - Side by side */}
      <div className="grid grid-cols-2 gap-2 md:gap-3">
        <div className="card p-2 md:p-3">
          <div className="text-[10px] md:text-xs text-gray-500 font-medium mb-1.5 md:mb-2 uppercase tracking-wider">Source</div>
          <div className="bg-gray-800/50 rounded-lg h-20 md:h-24 overflow-hidden flex items-center justify-center">
            {sourceImage ? (
              <img src={sourceImage} alt="Source" className="w-full h-full object-contain" />
            ) : (
              <div className="text-gray-600 text-[10px] md:text-xs">No source</div>
            )}
          </div>
        </div>
        <div className="card p-2 md:p-3">
          <div className="text-[10px] md:text-xs text-gray-500 font-medium mb-1.5 md:mb-2 uppercase tracking-wider">Target</div>
          <div className="bg-gray-800/50 rounded-lg h-20 md:h-24 overflow-hidden flex items-center justify-center">
            {targetImage ? (
              <img src={targetImage} alt="Target" className="w-full h-full object-contain" />
            ) : (
              <div className="text-gray-600 text-[10px] md:text-xs">No target</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
