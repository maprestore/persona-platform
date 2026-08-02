import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const faqs = [
  { q: 'What is Persona Studio?', a: 'Persona Studio is an AI-powered identity transformation platform that offers face swapping, voice cloning, portrait animation, background removal, and AI filtering. Our tools are designed for creators, businesses, and individuals who want professional-grade AI transformations.' },
  { q: 'How do credits work?', a: 'Credits are the currency used for AI transformations. Different features cost different amounts of credits (e.g., Face Swap = 1 credit, Video Swap = 5 credits). You can purchase credit packages starting from $5 for 50 credits.' },
  { q: 'Is my data safe?', a: 'Yes. All uploaded files are encrypted in transit and at rest. Files are automatically deleted within 24 hours of processing. We never use your content to train AI models without explicit consent.' },
  { q: 'How do I get a refund?', a: 'Refund requests are handled within 14 days of purchase. Contact our support team with your order details and we\'ll process your request promptly.' },
  { q: 'Can I use the API?', a: 'Yes! We provide a RESTful API for developers. You can generate API keys from your dashboard and access our comprehensive API documentation.' },
  { q: 'What file formats are supported?', a: 'We support JPG, PNG, WEBP for images and MP4, MOV for videos. Maximum file size is 100MB per upload.' },
  { q: 'How accurate are the AI transformations?', a: 'Our AI models achieve industry-leading accuracy. Results vary based on input quality, lighting, and angle. We recommend high-quality, well-lit photos for best results.' },
  { q: 'Do you offer enterprise plans?', a: 'Yes, we offer custom enterprise plans with dedicated support, higher rate limits, custom AI models, and SLA guarantees. Contact sales@personastudio.ai for details.' },
];

export default function HelpCenterPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

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
          <h1 className="text-3xl font-bold text-white mb-3">Help Center</h1>
          <p className="text-gray-400">Find answers to common questions and get the help you need</p>
        </div>

        {/* Quick Links */}
        <div className="grid md:grid-cols-3 gap-4 mb-12">
          <Link to="/contact" className="bg-gray-900 border border-gray-800 rounded-xl p-6 hover:border-indigo-500/50 transition-colors text-center">
            <span className="text-3xl block mb-3">💬</span>
            <h3 className="text-white font-semibold mb-1">Contact Support</h3>
            <p className="text-gray-400 text-sm">Get personalized help from our team</p>
          </Link>
          <a href="#faq" className="bg-gray-900 border border-gray-800 rounded-xl p-6 hover:border-indigo-500/50 transition-colors text-center">
            <span className="text-3xl block mb-3">❓</span>
            <h3 className="text-white font-semibold mb-1">FAQ</h3>
            <p className="text-gray-400 text-sm">Browse frequently asked questions</p>
          </a>
          <a href="#" className="bg-gray-900 border border-gray-800 rounded-xl p-6 hover:border-indigo-500/50 transition-colors text-center">
            <span className="text-3xl block mb-3">📚</span>
            <h3 className="text-white font-semibold mb-1">Documentation</h3>
            <p className="text-gray-400 text-sm">Read our API and feature docs</p>
          </a>
        </div>

        {/* Getting Started */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 mb-8">
          <h2 className="text-xl font-semibold text-white mb-4">Getting Started</h2>
          <div className="space-y-4">
            <div className="flex gap-4 items-start">
              <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-sm">1</span>
              </div>
              <div>
                <h3 className="text-white font-medium">Create Your Account</h3>
                <p className="text-gray-400 text-sm">Sign up with your email and get 10 free credits to start exploring.</p>
              </div>
            </div>
            <div className="flex gap-4 items-start">
              <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-sm">2</span>
              </div>
              <div>
                <h3 className="text-white font-medium">Choose a Tool</h3>
                <p className="text-gray-400 text-sm">Navigate to AI Studio and select from Face Swap, Portrait, Background, Filter, or Voice Clone.</p>
              </div>
            </div>
            <div className="flex gap-4 items-start">
              <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-sm">3</span>
              </div>
              <div>
                <h3 className="text-white font-medium">Upload & Transform</h3>
                <p className="text-gray-400 text-sm">Upload your image or video, and let our AI work its magic in seconds.</p>
              </div>
            </div>
            <div className="flex gap-4 items-start">
              <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-sm">4</span>
              </div>
              <div>
                <h3 className="text-white font-medium">Download & Share</h3>
                <p className="text-gray-400 text-sm">Download your result and share it with the world. Credits are only deducted on successful transformations.</p>
              </div>
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div id="faq">
          <h2 className="text-xl font-semibold text-white mb-4">Frequently Asked Questions</h2>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-gray-800/50 transition-colors"
                >
                  <span className="text-white font-medium">{faq.q}</span>
                  <span className={`text-gray-400 transition-transform ${openFaq === i ? 'rotate-180' : ''}`}>
                    ▼
                  </span>
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-4">
                    <p className="text-gray-300 text-sm leading-relaxed">{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
