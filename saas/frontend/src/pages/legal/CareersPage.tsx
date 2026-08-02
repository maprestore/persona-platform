import React from 'react';
import { Link } from 'react-router-dom';

const openPositions = [
  { title: 'Senior ML Engineer', department: 'Engineering', location: 'Remote', type: 'Full-time', description: 'Build and optimize our AI models for face swap, voice clone, and real-time processing.' },
  { title: 'Full-Stack Developer', department: 'Engineering', location: 'Remote', type: 'Full-time', description: 'Help build and scale our React/Python platform serving millions of transformations.' },
  { title: 'Product Designer', department: 'Design', location: 'Remote', type: 'Full-time', description: 'Design intuitive interfaces for complex AI-powered creative tools.' },
  { title: 'DevOps Engineer', department: 'Engineering', location: 'Remote', type: 'Full-time', description: 'Manage GPU infrastructure, CI/CD pipelines, and ensure 99.99% uptime.' },
  { title: 'Growth Marketing Manager', department: 'Marketing', location: 'Remote', type: 'Full-time', description: 'Drive user acquisition and retention through data-driven marketing strategies.' },
  { title: 'Customer Success Lead', department: 'Support', location: 'Remote', type: 'Full-time', description: 'Help our users succeed with personalized support and onboarding.' },
];

const benefits = [
  { icon: '🌍', title: 'Remote-First', description: 'Work from anywhere in the world' },
  { icon: '💰', title: 'Competitive Pay', description: 'Top-of-market compensation' },
  { icon: '📈', title: 'Equity', description: 'Stock options for all employees' },
  { icon: '🏥', title: 'Health Insurance', description: 'Comprehensive health coverage' },
  { icon: '🎓', title: 'Learning Budget', description: '$2,000/year for courses and conferences' },
  { icon: '🏖️', title: 'Unlimited PTO', description: 'Take time off when you need it' },
  { icon: '💻', title: 'Equipment', description: 'Latest MacBook Pro or equivalent' },
  { icon: '🤝', title: 'Team Events', description: 'Annual team retreats and meetups' },
];

export default function CareersPage() {
  return (
    <div className="min-h-screen bg-gray-950">
      <div className="border-b border-gray-800">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center">
              <span className="text-xl">🎭</span>
            </div>
            <span className="text-xl font-bold text-white">Persona Studio</span>
          </Link>
          <Link to="/" className="text-gray-400 hover:text-white transition-colors text-sm">Back to Home</Link>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-white mb-3">Join Our Team</h1>
          <p className="text-gray-400 max-w-2xl mx-auto">
            We're building the future of AI-powered creative tools. Join us and help make professional-grade
            identity transformation accessible to everyone.
          </p>
        </div>

        {/* Benefits */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-white text-center mb-8">Why Work at Persona Studio?</h2>
          <div className="grid md:grid-cols-4 gap-4">
            {benefits.map((b, i) => (
              <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-5 text-center hover:border-gray-700 transition-colors">
                <span className="text-3xl block mb-2">{b.icon}</span>
                <h3 className="text-white font-semibold text-sm mb-1">{b.title}</h3>
                <p className="text-gray-400 text-xs">{b.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Open Positions */}
        <div>
          <h2 className="text-2xl font-bold text-white mb-6">Open Positions</h2>
          <div className="space-y-4">
            {openPositions.map((pos, i) => (
              <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-6 hover:border-indigo-500/50 transition-colors">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-white font-semibold text-lg">{pos.title}</h3>
                    <p className="text-gray-400 text-sm mt-1">{pos.description}</p>
                    <div className="flex items-center gap-3 mt-3">
                      <span className="text-xs px-2 py-0.5 bg-indigo-600/20 text-indigo-400 rounded">{pos.department}</span>
                      <span className="text-xs text-gray-500">{pos.location}</span>
                      <span className="text-xs text-gray-500">{pos.type}</span>
                    </div>
                  </div>
                  <Link
                    to="/contact"
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl transition-colors whitespace-nowrap"
                  >
                    Apply Now
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
