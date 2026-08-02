import React from 'react';
import { Link } from 'react-router-dom';

const channels = [
  { icon: '💬', title: 'Discord', description: 'Join our community of 10,000+ creators. Get help, share work, and chat with the team.', link: '#', members: '10.2K members' },
  { icon: '🐦', title: 'Twitter / X', description: 'Follow us for updates, tips, and showcase of community creations.', link: '#', members: '25K followers' },
  { icon: '📸', title: 'Instagram', description: 'See transformations and behind-the-scenes content from our community.', link: '#', members: '18K followers' },
  { icon: '📺', title: 'YouTube', description: 'Tutorials, demos, and deep dives into our AI technology.', link: '#', members: '50K subscribers' },
  { icon: '💼', title: 'LinkedIn', description: 'Company updates, job openings, and industry insights.', link: '#', members: '8K followers' },
  { icon: '📝', title: 'Reddit', description: 'Join r/PersonaStudio for discussions, feedback, and community showcases.', link: '#', members: '15K members' },
];

const guidelines = [
  { icon: '🤝', title: 'Be Respectful', description: 'Treat everyone with respect and kindness. We have zero tolerance for harassment or discrimination.' },
  { icon: '🎯', title: 'Stay On Topic', description: 'Keep discussions relevant to Persona Studio, AI, and creative content.' },
  { icon: '🔒', title: 'Respect Privacy', description: 'Never share others\' personal information or private content without consent.' },
  { icon: '⚡', title: 'No Spam', description: 'Avoid self-promotion, spam, or off-topic advertising.' },
  { icon: '💡', title: 'Help Others', description: 'If you can help someone with a question, please do! We\'re all learning together.' },
  { icon: '🚫', title: 'No NSFW Content', description: 'Do not share explicit, violent, or harmful content. Violations will result in immediate bans.' },
];

export default function CommunityPage() {
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
          <h1 className="text-3xl font-bold text-white mb-3">Join Our Community</h1>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Connect with thousands of creators, share your work, get help, and stay updated on the latest features.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-indigo-400">75K+</p>
            <p className="text-gray-400 text-sm">Community Members</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-purple-400">5K+</p>
            <p className="text-gray-400 text-sm">Shared Creations</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-pink-400">200+</p>
            <p className="text-gray-400 text-sm">Tutorials</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-green-400">24/7</p>
            <p className="text-gray-400 text-sm">Community Support</p>
          </div>
        </div>

        {/* Social Channels */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-white text-center mb-8">Connect With Us</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {channels.map((ch, i) => (
              <a key={i} href={ch.link} target="_blank" rel="noopener noreferrer" className="bg-gray-900 border border-gray-800 rounded-xl p-6 hover:border-indigo-500/50 transition-colors group">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-3xl group-hover:scale-110 transition-transform">{ch.icon}</span>
                  <div>
                    <h3 className="text-white font-semibold">{ch.title}</h3>
                    <p className="text-gray-500 text-xs">{ch.members}</p>
                  </div>
                </div>
                <p className="text-gray-400 text-sm">{ch.description}</p>
              </a>
            ))}
          </div>
        </div>

        {/* Community Guidelines */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8">
          <h2 className="text-xl font-semibold text-white mb-6">Community Guidelines</h2>
          <div className="grid md:grid-cols-2 gap-6">
            {guidelines.map((g, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="text-2xl flex-shrink-0">{g.icon}</span>
                <div>
                  <h3 className="text-white font-medium mb-1">{g.title}</h3>
                  <p className="text-gray-400 text-sm">{g.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
