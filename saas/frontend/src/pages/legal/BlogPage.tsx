import React from 'react';
import { Link } from 'react-router-dom';

const posts = [
  { title: 'Introducing Persona Studio 2.0', date: 'July 15, 2026', category: 'Product', excerpt: 'Major update with live portrait animation, voice cloning, and real-time face swap for video calls.', readTime: '5 min' },
  { title: 'How Our AI Face Swap Works', date: 'June 28, 2026', category: 'Technology', excerpt: 'Deep dive into the neural network architecture behind our industry-leading face swap technology.', readTime: '8 min' },
  { title: 'Best Practices for Face Swap Results', date: 'June 10, 2026', category: 'Tutorial', excerpt: 'Tips and tricks for getting the best results from our AI transformation tools.', readTime: '4 min' },
  { title: 'Privacy-First AI: How We Protect Your Data', date: 'May 22, 2026', category: 'Security', excerpt: 'A look at our encryption, data handling, and privacy commitment.', readTime: '6 min' },
  { title: 'API Integration Guide', date: 'May 5, 2026', category: 'Developer', excerpt: 'Step-by-step guide to integrating Persona Studio API into your application.', readTime: '10 min' },
  { title: 'The Future of AI Identity Transformation', date: 'April 18, 2026', category: 'Insights', excerpt: 'Our vision for the next generation of AI-powered creative tools.', readTime: '7 min' },
];

export default function BlogPage() {
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
        <div className="mb-12">
          <h1 className="text-3xl font-bold text-white mb-3">Blog</h1>
          <p className="text-gray-400">News, tutorials, and insights from the Persona Studio team</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {posts.map((post, i) => (
            <article key={i} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden hover:border-gray-700 transition-colors group cursor-pointer">
              <div className="h-48 bg-gradient-to-br from-indigo-600/20 to-purple-600/20 flex items-center justify-center">
                <span className="text-5xl group-hover:scale-110 transition-transform">
                  {post.category === 'Product' ? '🚀' :
                   post.category === 'Technology' ? '🤖' :
                   post.category === 'Tutorial' ? '📖' :
                   post.category === 'Security' ? '🔒' :
                   post.category === 'Developer' ? '👨‍💻' : '💡'}
                </span>
              </div>
              <div className="p-6">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-xs px-2 py-0.5 bg-indigo-600/20 text-indigo-400 rounded">{post.category}</span>
                  <span className="text-xs text-gray-500">{post.readTime} read</span>
                </div>
                <h2 className="text-lg font-semibold text-white mb-2 group-hover:text-indigo-400 transition-colors">{post.title}</h2>
                <p className="text-gray-400 text-sm mb-4">{post.excerpt}</p>
                <p className="text-xs text-gray-500">{post.date}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
