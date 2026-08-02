import React from 'react';
import { Link } from 'react-router-dom';

const team = [
  { name: 'Alex Chen', role: 'CEO & Founder', icon: '👨‍💻', bio: 'Former AI researcher with 10+ years in computer vision and machine learning.' },
  { name: 'Sarah Kim', role: 'CTO', icon: '👩‍🔬', bio: 'Ex-Google engineer specializing in distributed systems and GPU computing.' },
  { name: 'Marcus Johnson', role: 'Head of Design', icon: '🎨', bio: 'Award-winning designer focused on creating intuitive AI-powered experiences.' },
  { name: 'Elena Rodriguez', role: 'Head of AI', icon: '🤖', bio: 'PhD in Deep Learning, pioneered multiple face generation techniques.' },
];

const milestones = [
  { year: '2024', title: 'Founded', description: 'Persona Studio was founded with a vision to democratize AI-powered identity transformation.' },
  { year: '2024', title: 'Seed Round', description: 'Raised $2M seed funding to build the core AI engine and platform.' },
  { year: '2025', title: 'Beta Launch', description: 'Launched beta with 1,000 early adopters and processed 50,000 transformations.' },
  { year: '2025', title: 'Public Launch', description: 'Opened to the public with enterprise features and API access.' },
  { year: '2026', title: 'Series A', description: 'Raised $12M Series A to expand globally and develop next-gen AI models.' },
];

const values = [
  { icon: '🎯', title: 'Innovation', description: 'Pushing the boundaries of what AI can do with identity and creative expression.' },
  { icon: '🔒', title: 'Privacy First', description: 'Your data is yours. We process and delete content responsibly.' },
  { icon: '🌍', title: 'Accessibility', description: 'Making professional-grade AI tools available to everyone, not just studios.' },
  { icon: '⚡', title: 'Performance', description: 'Lightning-fast processing with enterprise-grade reliability.' },
  { icon: '🤝', title: 'Trust', description: 'Transparent about our capabilities, limitations, and data practices.' },
  { icon: '📈', title: 'Continuous Learning', description: 'Constantly improving our models based on user feedback and research.' },
];

export default function AboutPage() {
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
        {/* Hero */}
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold text-white mb-4">Redefining Creative Identity</h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            We're building the future of AI-powered identity transformation, making professional-grade
            tools accessible to creators, businesses, and individuals worldwide.
          </p>
        </div>

        {/* Mission */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 mb-12">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <h2 className="text-2xl font-bold text-white mb-4">Our Mission</h2>
              <p className="text-gray-300 leading-relaxed mb-4">
                At Persona Studio, we believe everyone deserves access to cutting-edge AI technology.
                Our mission is to democratize identity transformation tools that were once only available
                to major studios and enterprises.
              </p>
              <p className="text-gray-300 leading-relaxed">
                From face swapping and voice cloning to portrait animation and background removal, we're
                empowering millions of creators to bring their visions to life with the power of artificial intelligence.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-800 rounded-xl p-4 text-center">
                <p className="text-3xl font-bold text-indigo-400">2M+</p>
                <p className="text-gray-400 text-sm mt-1">Transformations</p>
              </div>
              <div className="bg-gray-800 rounded-xl p-4 text-center">
                <p className="text-3xl font-bold text-purple-400">50K+</p>
                <p className="text-gray-400 text-sm mt-1">Active Users</p>
              </div>
              <div className="bg-gray-800 rounded-xl p-4 text-center">
                <p className="text-3xl font-bold text-pink-400">99.9%</p>
                <p className="text-gray-400 text-sm mt-1">Uptime</p>
              </div>
              <div className="bg-gray-800 rounded-xl p-4 text-center">
                <p className="text-3xl font-bold text-green-400">4.9/5</p>
                <p className="text-gray-400 text-sm mt-1">User Rating</p>
              </div>
            </div>
          </div>
        </div>

        {/* Values */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-white text-center mb-8">Our Values</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {values.map((v, i) => (
              <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-6 hover:border-gray-700 transition-colors">
                <span className="text-3xl block mb-3">{v.icon}</span>
                <h3 className="text-lg font-semibold text-white mb-2">{v.title}</h3>
                <p className="text-gray-400 text-sm">{v.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Timeline */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-white text-center mb-8">Our Journey</h2>
          <div className="space-y-6">
            {milestones.map((m, i) => (
              <div key={i} className="flex gap-6 items-start">
                <div className="flex-shrink-0 w-16 text-center">
                  <div className="w-16 h-16 bg-indigo-600/20 border border-indigo-500/30 rounded-full flex items-center justify-center">
                    <span className="text-indigo-400 font-bold text-sm">{m.year}</span>
                  </div>
                </div>
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex-1">
                  <h3 className="text-white font-semibold mb-1">{m.title}</h3>
                  <p className="text-gray-400 text-sm">{m.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Team */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-white text-center mb-8">Leadership Team</h2>
          <div className="grid md:grid-cols-4 gap-6">
            {team.map((t, i) => (
              <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center hover:border-gray-700 transition-colors">
                <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl">{t.icon}</span>
                </div>
                <h3 className="text-white font-semibold">{t.name}</h3>
                <p className="text-indigo-400 text-sm mb-2">{t.role}</p>
                <p className="text-gray-400 text-xs">{t.bio}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="bg-gradient-to-r from-indigo-600/20 to-purple-600/20 border border-indigo-500/30 rounded-2xl p-8 text-center">
          <h2 className="text-2xl font-bold text-white mb-3">Join Our Team</h2>
          <p className="text-gray-400 mb-6 max-w-lg mx-auto">
            We're always looking for talented people who are passionate about AI and creative technology.
          </p>
          <div className="flex justify-center gap-4">
            <Link to="/careers" className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl transition-colors">
              View Open Positions
            </Link>
            <Link to="/contact" className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-xl transition-colors">
              Contact Us
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
