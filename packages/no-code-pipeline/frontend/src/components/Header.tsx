
import React, { useEffect, useState } from 'react';
import { api } from '../api';

interface Props {
  serverStatus: 'connected' | 'disconnected';
  onStatusChange: (status: 'connected' | 'disconnected') => void;
}

export default function Header({ serverStatus, onStatusChange }: Props) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const check = async () => {
      try {
        const res = await api.health();
        onStatusChange(res.status === 'ok' ? 'connected' : 'disconnected');
      } catch {
        onStatusChange('disconnected');
      }
    };
    check();
    const interval = setInterval(check, 5000);
    return () => clearInterval(interval);
  }, [onStatusChange]);

  return (
    <header className="h-12 md:h-14 bg-gray-900/80 backdrop-blur-sm border-b border-gray-800 flex items-center justify-between px-3 md:px-6">
      <div className="flex items-center gap-2 md:gap-3">
        <div className="w-7 h-7 md:w-8 md:h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
          <svg className="w-4 h-4 md:w-5 md:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
        <h1 className="text-base md:text-lg font-semibold text-white">Persona Studio</h1>
        <span className="hidden sm:inline text-xs text-gray-500 font-medium">v0.1.0</span>
      </div>

      <div className="flex items-center gap-2 md:gap-4">
        <div className="hidden sm:block text-sm text-gray-400 font-mono">
          {time.toLocaleTimeString()}
        </div>
        <div className="flex items-center gap-1.5 md:gap-2">
          <div className={`w-2 h-2 rounded-full ${serverStatus === 'connected' ? 'bg-emerald-400' : 'bg-red-400'}`} />
          <span className={`text-xs md:text-sm font-medium ${serverStatus === 'connected' ? 'text-emerald-400' : 'text-red-400'}`}>
            <span className="hidden sm:inline">{serverStatus === 'connected' ? 'Connected' : 'Disconnected'}</span>
            <span className="sm:hidden">{serverStatus === 'connected' ? 'Online' : 'Offline'}</span>
          </span>
        </div>
      </div>
    </header>
  );
}
