import React from 'react';
import { Link } from 'react-router-dom';

export default function PressKitPage() {
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
        <div className="mb-12">
          <h1 className="text-3xl font-bold text-white mb-3">Press Kit</h1>
          <p className="text-gray-400">Brand assets and media resources for journalists and partners</p>
        </div>

        {/* Brand Overview */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 mb-8">
          <h2 className="text-xl font-semibold text-white mb-4">Brand Overview</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-white font-medium mb-2">Company Name</h3>
              <p className="text-gray-300">Persona Studio</p>
            </div>
            <div>
              <h3 className="text-white font-medium mb-2">Tagline</h3>
              <p className="text-gray-300">AI-Powered Identity Transformation</p>
            </div>
            <div>
              <h3 className="text-white font-medium mb-2">Founded</h3>
              <p className="text-gray-300">2024</p>
            </div>
            <div>
              <h3 className="text-white font-medium mb-2">Headquarters</h3>
              <p className="text-gray-300">San Francisco, CA (Remote-first)</p>
            </div>
            <div className="md:col-span-2">
              <h3 className="text-white font-medium mb-2">Description</h3>
              <p className="text-gray-300">
                Persona Studio is an AI-powered identity transformation platform that enables creators,
                businesses, and individuals to perform face swapping, voice cloning, portrait animation,
                background removal, and AI filtering using cutting-edge machine learning technology.
              </p>
            </div>
          </div>
        </div>

        {/* Key Facts */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 mb-8">
          <h2 className="text-xl font-semibold text-white mb-4">Key Facts</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-indigo-600/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-indigo-400 text-sm">👥</span>
              </div>
              <div>
                <p className="text-white font-medium">50,000+</p>
                <p className="text-gray-400 text-sm">Active users worldwide</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-purple-600/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-purple-400 text-sm">⚡</span>
              </div>
              <div>
                <p className="text-white font-medium">2M+</p>
                <p className="text-gray-400 text-sm">AI transformations processed</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-pink-600/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-pink-400 text-sm">🌍</span>
              </div>
              <div>
                <p className="text-white font-medium">120+</p>
                <p className="text-gray-400 text-sm">Countries served</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-green-600/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-green-400 text-sm">🔒</span>
              </div>
              <div>
                <p className="text-white font-medium">99.99%</p>
                <p className="text-gray-400 text-sm">Platform uptime</p>
              </div>
            </div>
          </div>
        </div>

        {/* Brand Assets */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 mb-8">
          <h2 className="text-xl font-semibold text-white mb-4">Brand Assets</h2>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="bg-gray-800 rounded-xl p-6 text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <span className="text-4xl">🎭</span>
              </div>
              <p className="text-white font-medium mb-1">Primary Logo</p>
              <button className="text-indigo-400 text-sm hover:text-indigo-300">Download PNG</button>
            </div>
            <div className="bg-gray-800 rounded-xl p-6 text-center">
              <div className="w-20 h-20 bg-gray-900 border border-gray-700 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <span className="text-4xl">🎭</span>
              </div>
              <p className="text-white font-medium mb-1">Light Logo</p>
              <button className="text-indigo-400 text-sm hover:text-indigo-300">Download PNG</button>
            </div>
            <div className="bg-gray-800 rounded-xl p-6 text-center">
              <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center mx-auto mb-3">
                <span className="text-4xl">🎭</span>
              </div>
              <p className="text-white font-medium mb-1">Icon Only</p>
              <button className="text-indigo-400 text-sm hover:text-indigo-300">Download PNG</button>
            </div>
          </div>
        </div>

        {/* Contact */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8">
          <h2 className="text-xl font-semibold text-white mb-4">Media Inquiries</h2>
          <p className="text-gray-300 mb-4">
            For press inquiries, interviews, or media requests, please contact our communications team.
          </p>
          <div className="space-y-2">
            <p className="text-gray-300">Email: <span className="text-indigo-400">press@personastudio.ai</span></p>
            <p className="text-gray-300">General: <span className="text-indigo-400">hello@personastudio.ai</span></p>
          </div>
        </div>
      </div>
    </div>
  );
}
