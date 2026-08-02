
import React from 'react';

interface Props {
  serverStatus: 'connected' | 'disconnected';
}

export default function StatusBar({ serverStatus }: Props) {
  const host = window.location.hostname;
  return (
    <footer className="h-7 md:h-8 bg-gray-900/80 border-t border-gray-800 flex items-center justify-between px-3 md:px-6 text-[10px] md:text-xs text-gray-500">
      <div className="flex items-center gap-2 md:gap-4">
        <span className="hidden sm:inline">Persona Studio</span>
        <span className="hidden sm:inline">|</span>
        <span>API: {host}:6967</span>
        <span className="hidden md:inline">|</span>
        <span className="hidden md:inline">V4L2 Virtual Camera</span>
      </div>
      <div className="flex items-center gap-2 md:gap-4">
        <span className={serverStatus === 'connected' ? 'text-emerald-500' : 'text-red-500'}>
          {serverStatus === 'connected' ? 'Online' : 'Offline'}
        </span>
      </div>
    </footer>
  );
}
