import React from 'react';
import { Link } from 'react-router-dom';

const services = [
  { name: 'API Gateway', status: 'operational', uptime: '99.99%', latency: '45ms' },
  { name: 'AI Engine (Face Swap)', status: 'operational', uptime: '99.98%', latency: '120ms' },
  { name: 'AI Engine (Voice Clone)', status: 'operational', uptime: '99.95%', latency: '180ms' },
  { name: 'File Storage', status: 'operational', uptime: '99.99%', latency: '12ms' },
  { name: 'Payment Processing', status: 'operational', uptime: '99.99%', latency: '85ms' },
  { name: 'CDN', status: 'operational', uptime: '100%', latency: '8ms' },
];

const incidents = [
  {
    date: 'July 28, 2026',
    title: 'Scheduled Maintenance - Database Upgrade',
    status: 'completed',
    duration: '30 minutes',
    description: 'Database upgrade to improve performance. No downtime expected for users.',
  },
  {
    date: 'July 15, 2026',
    title: 'Elevated Latency on Voice Clone',
    status: 'resolved',
    duration: '2 hours',
    description: 'Some users experienced slower than normal voice clone processing. Issue resolved by scaling GPU instances.',
  },
];

export default function StatusPage() {
  const allOperational = services.every(s => s.status === 'operational');

  return (
    <div className="min-h-screen bg-gray-950">
      <div className="border-b border-gray-800">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center">
              <span className="text-xl">🎭</span>
            </div>
            <span className="text-xl font-bold text-white">Persona Studio</span>
          </Link>
          <Link to="/" className="text-gray-400 hover:text-white transition-colors text-sm">Back to Home</Link>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-white mb-3">System Status</h1>
          <p className="text-gray-400">Real-time status of all Persona Studio services</p>
        </div>

        {/* Overall Status */}
        <div className={`rounded-xl p-6 mb-8 text-center ${
          allOperational
            ? 'bg-green-500/10 border border-green-500/30'
            : 'bg-yellow-500/10 border border-yellow-500/30'
        }`}>
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className={`w-3 h-3 rounded-full ${allOperational ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`} />
            <h2 className={`text-xl font-semibold ${allOperational ? 'text-green-400' : 'text-yellow-400'}`}>
              {allOperational ? 'All Systems Operational' : 'Some Systems Experiencing Issues'}
            </h2>
          </div>
          <p className="text-gray-400 text-sm">Last updated: {new Date().toLocaleString()}</p>
        </div>

        {/* Services */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden mb-8">
          <div className="px-6 py-4 border-b border-gray-800">
            <h2 className="text-lg font-semibold text-white">Service Status</h2>
          </div>
          <div className="divide-y divide-gray-800">
            {services.map((service, i) => (
              <div key={i} className="px-6 py-4 flex items-center justify-between hover:bg-gray-800/30 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full ${
                    service.status === 'operational' ? 'bg-green-500' :
                    service.status === 'degraded' ? 'bg-yellow-500' : 'bg-red-500'
                  }`} />
                  <span className="text-white font-medium">{service.name}</span>
                </div>
                <div className="flex items-center gap-6 text-sm">
                  <span className="text-gray-400">{service.latency}</span>
                  <span className="text-gray-400">{service.uptime} uptime</span>
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    service.status === 'operational' ? 'bg-green-500/20 text-green-400' :
                    service.status === 'degraded' ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-red-500/20 text-red-400'
                  }`}>
                    {service.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Past Incidents */}
        <div>
          <h2 className="text-xl font-semibold text-white mb-4">Past Incidents</h2>
          <div className="space-y-4">
            {incidents.map((incident, i) => (
              <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-white font-medium">{incident.title}</h3>
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    incident.status === 'resolved' ? 'bg-green-500/20 text-green-400' :
                    incident.status === 'completed' ? 'bg-blue-500/20 text-blue-400' :
                    'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    {incident.status}
                  </span>
                </div>
                <p className="text-gray-400 text-sm mb-2">{incident.description}</p>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span>{incident.date}</span>
                  <span>Duration: {incident.duration}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
