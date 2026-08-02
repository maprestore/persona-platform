import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const features = [
  {
    icon: '🎭',
    title: 'Face Swap',
    description: 'Transform your photos with AI-powered face swapping technology. Seamlessly blend faces with stunning realism.',
    color: 'from-purple-500 to-pink-500',
  },
  {
    icon: '🎬',
    title: 'Video Transform',
    description: 'Bring your videos to life with dynamic face swaps and visual effects that captivate audiences.',
    color: 'from-blue-500 to-cyan-500',
  },
  {
    icon: '🖼️',
    title: 'Live Portrait',
    description: 'Animate static portraits with natural movements and expressions using cutting-edge AI.',
    color: 'from-orange-500 to-red-500',
  },
  {
    icon: '🎨',
    title: 'Background Magic',
    description: 'Replace or enhance backgrounds instantly. Transport yourself to any location or create artistic scenes.',
    color: 'from-green-500 to-teal-500',
  },
  {
    icon: '✨',
    title: 'AI Filters',
    description: 'Apply professional-grade filters and enhancements powered by machine learning algorithms.',
    color: 'from-yellow-500 to-orange-500',
  },
  {
    icon: '🔊',
    title: 'Voice Clone',
    description: 'Clone and modify voices with AI precision. Create realistic voice reproductions for any project.',
    color: 'from-indigo-500 to-purple-500',
  },
];

const pricingPlans = [
  {
    name: 'Starter',
    price: '9.99',
    credits: 50,
    features: [
      '50 Credits',
      'Basic Face Swap',
      'Standard Quality',
      'Email Support',
    ],
    popular: false,
    gradient: 'from-gray-800 to-gray-900',
  },
  {
    name: 'Pro',
    price: '29.99',
    credits: 200,
    features: [
      '200 Credits',
      'All AI Features',
      'HD Quality',
      'Priority Support',
      'API Access',
    ],
    popular: true,
    gradient: 'from-indigo-600 to-purple-600',
  },
  {
    name: 'Enterprise',
    price: '99.99',
    credits: 1000,
    features: [
      '1000 Credits',
      'All AI Features',
      '4K Quality',
      '24/7 Support',
      'Custom API',
      'Team Access',
    ],
    popular: false,
    gradient: 'from-gray-800 to-gray-900',
  },
];

const testimonials = [
  {
    name: 'Sarah Johnson',
    role: 'Content Creator',
    avatar: '👩‍💻',
    content: 'Persona Studio has revolutionized my content creation workflow. The face swap quality is incredible!',
  },
  {
    name: 'Mike Chen',
    role: 'Digital Artist',
    avatar: '👨‍🎨',
    content: 'The AI filters and background replacement features save me hours of editing time. Absolutely game-changing.',
  },
  {
    name: 'Emma Davis',
    role: 'Marketing Manager',
    avatar: '👩‍💼',
    content: 'Our team uses Persona Studio for all our visual content. The API integration makes it seamless.',
  },
];

const stats = [
  { value: '10M+', label: 'Transformations' },
  { value: '50K+', label: 'Active Users' },
  { value: '99.9%', label: 'Uptime' },
  { value: '4.9/5', label: 'User Rating' },
];

const trustedBy = [
  { name: 'Netflix', logo: '🎬' },
  { name: 'Disney', logo: '🏰' },
  { name: 'Adobe', logo: '🎨' },
  { name: 'Spotify', logo: '🎵' },
  { name: 'Slack', logo: '💬' },
  { name: 'Notion', logo: '📝' },
];

const faqs = [
  {
    question: 'What is Persona Studio?',
    answer: 'Persona Studio is an AI-powered platform that enables face swapping, video transformation, live portrait animation, background replacement, and voice cloning. It\'s designed for content creators, marketers, and professionals who need high-quality visual transformations.',
  },
  {
    question: 'How does the credit system work?',
    answer: 'Each AI feature costs a certain number of credits. For example, a face swap costs 1 credit, while a video swap costs 5 credits. You can purchase credit packages starting at $9.99 for 50 credits. Unused credits never expire.',
  },
  {
    question: 'Is there a free trial?',
    answer: 'Yes! New users receive 10 free credits upon signup. This allows you to test all features before committing to a paid plan. No credit card required for the free trial.',
  },
  {
    question: 'What file formats are supported?',
    answer: 'We support all major image formats (JPG, PNG, WEBP, BMP) and video formats (MP4, AVI, MOV, MKV, WebM). Maximum file size is 100MB for images and 500MB for videos.',
  },
  {
    question: 'How fast is the processing?',
    answer: 'Most transformations complete in under 30 seconds. Video processing depends on length and complexity, typically 1-5 minutes. Our GPU-accelerated servers ensure fast turnaround times.',
  },
  {
    question: 'Is my data secure?',
    answer: 'Absolutely. All uploads are encrypted in transit and at rest. We automatically delete your files after 24 hours unless you choose to save them. We never use your images for training or sharing.',
  },
  {
    question: 'Can I use the API?',
    answer: 'Yes! Pro and Enterprise plans include full API access. Our RESTful API supports all features with comprehensive documentation, SDKs for Python/Node.js, and webhook support.',
  },
  {
    question: 'What payment methods do you accept?',
    answer: 'We accept all major credit cards, PayPal, and cryptocurrency (USDT, BTC, ETH). All payments are processed securely through Stripe.',
  },
];

const beforeAfterExamples = [
  { label: 'Face Swap', before: '🧑', after: '👩', color: 'from-purple-500 to-pink-500' },
  { label: 'Background', before: '🏠', after: '🏖️', color: 'from-blue-500 to-cyan-500' },
  { label: 'Style Transfer', before: '📷', after: '🎨', color: 'from-orange-500 to-red-500' },
];

export default function HomePage() {
  const [scrollY, setScrollY] = useState(0);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);
  const [activeDemo, setActiveDemo] = useState(0);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveDemo((prev) => (prev + 1) % beforeAfterExamples.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      setSubscribed(true);
      setEmail('');
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white overflow-x-hidden">
      {/* Animated Background */}
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/20 via-purple-900/20 to-pink-900/20"></div>
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-pink-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '4s' }}></div>
      </div>

      {/* Navigation */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrollY > 50 ? 'bg-gray-950/80 backdrop-blur-xl border-b border-gray-800' : ''}`}>
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center">
              <span className="text-xl">🎭</span>
            </div>
            <span className="text-xl font-bold">Persona Studio</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-gray-400 hover:text-white transition-colors">Features</a>
            <a href="#demo" className="text-gray-400 hover:text-white transition-colors">Demo</a>
            <a href="#pricing" className="text-gray-400 hover:text-white transition-colors">Pricing</a>
            <a href="#faq" className="text-gray-400 hover:text-white transition-colors">FAQ</a>
          </div>
          <div className="flex items-center gap-4">
            <Link
              to="/login"
              className="px-5 py-2.5 text-gray-300 hover:text-white transition-colors"
            >
              Sign In
            </Link>
            <Link
              to="/signup"
              className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 rounded-xl font-medium transition-all shadow-lg shadow-indigo-500/25"
            >
              Get Started Free
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 min-h-screen flex items-center justify-center px-6 pt-20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-500/10 border border-indigo-500/20 rounded-full mb-8">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
              <span className="text-sm text-indigo-300">Powered by Advanced AI Technology</span>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
              Transform Your
              <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent"> Identity </span>
              with AI
            </h1>
            
            <p className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed">
              Create stunning face swaps, animate portraits, and transform visuals with our cutting-edge AI platform. 
              Professional results in seconds, not hours.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
              <Link
                to="/signup"
                className="group px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 rounded-2xl font-semibold text-lg transition-all shadow-2xl shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:-translate-y-0.5"
              >
                Start Creating Free
                <span className="inline-block ml-2 group-hover:translate-x-1 transition-transform">→</span>
              </Link>
              <a
                href="#demo"
                className="group px-8 py-4 bg-gray-800/50 hover:bg-gray-800 border border-gray-700 rounded-2xl font-semibold text-lg transition-all flex items-center gap-2"
              >
                <span className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center group-hover:bg-white/20 transition-colors">
                  ▶️
                </span>
                Watch Demo
              </a>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto">
              {stats.map((stat, i) => (
                <div key={i} className="text-center">
                  <div className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                    {stat.value}
                  </div>
                  <div className="text-gray-500 text-sm mt-1">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Hero Demo Preview */}
          <div className="relative mt-16">
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 rounded-3xl blur-xl"></div>
            <div className="relative bg-gray-900/80 backdrop-blur-sm border border-gray-800 rounded-3xl p-8 overflow-hidden">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span className="ml-4 text-gray-500 text-sm">Persona Studio - Live Preview</span>
              </div>
              
              {/* Before/After Carousel */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                <div className="space-y-4">
                  <div className="flex items-center gap-4 mb-4">
                    {beforeAfterExamples.map((example, i) => (
                      <button
                        key={i}
                        onClick={() => setActiveDemo(i)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                          activeDemo === i
                            ? `bg-gradient-to-r ${example.color} text-white`
                            : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                        }`}
                      >
                        {example.label}
                      </button>
                    ))}
                  </div>
                  
                  <div className="bg-gray-800/50 rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-gray-400 text-sm">Before</span>
                      <span className="text-gray-400 text-sm">After</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-8xl">{beforeAfterExamples[activeDemo].before}</div>
                      <div className="text-4xl text-gray-600">→</div>
                      <div className="text-8xl">{beforeAfterExamples[activeDemo].after}</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span>⚡ Processing time: 2.3s</span>
                    <span>✓ Credits used: 1</span>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="bg-gray-800/30 rounded-xl p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-green-400">✓</span>
                      <span className="text-white font-medium">Real-time Processing</span>
                    </div>
                    <p className="text-gray-400 text-sm ml-6">GPU-accelerated AI models deliver results in seconds</p>
                  </div>
                  <div className="bg-gray-800/30 rounded-xl p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-green-400">✓</span>
                      <span className="text-white font-medium">4K Quality Output</span>
                    </div>
                    <p className="text-gray-400 text-sm ml-6">High-resolution results with perfect detail preservation</p>
                  </div>
                  <div className="bg-gray-800/30 rounded-xl p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-green-400">✓</span>
                      <span className="text-white font-medium">Privacy First</span>
                    </div>
                    <p className="text-gray-400 text-sm ml-6">Files auto-deleted after 24h, never used for training</p>
                  </div>
                  <div className="bg-gray-800/30 rounded-xl p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-green-400">✓</span>
                      <span className="text-white font-medium">API Access</span>
                    </div>
                    <p className="text-gray-400 text-sm ml-6">Integrate into your apps with our RESTful API</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trusted By Section */}
      <section className="relative z-10 py-16 px-6 border-t border-gray-800/50">
        <div className="max-w-6xl mx-auto">
          <p className="text-center text-gray-500 text-sm mb-8">Trusted by leading companies worldwide</p>
          <div className="flex flex-wrap items-center justify-center gap-12">
            {trustedBy.map((company, i) => (
              <div key={i} className="flex items-center gap-2 text-gray-600 hover:text-gray-400 transition-colors cursor-pointer">
                <span className="text-2xl">{company.logo}</span>
                <span className="text-lg font-semibold">{company.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="relative z-10 py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Powerful AI
              <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent"> Features</span>
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              Everything you need to create stunning visual content with the power of artificial intelligence
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <div
                key={i}
                className="group relative p-8 bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-3xl hover:border-gray-700 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl"
              >
                <div className={`w-14 h-14 bg-gradient-to-br ${feature.color} rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                  <span className="text-2xl">{feature.icon}</span>
                </div>
                <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
                <p className="text-gray-400 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Demo Section */}
      <section id="demo" className="relative z-10 py-32 px-6 bg-gray-900/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              See It in
              <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent"> Action</span>
            </h2>
            <p className="text-gray-400 text-lg">Watch how easy it is to transform your content</p>
          </div>

          {/* Video Demo Placeholder */}
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 rounded-3xl blur-xl"></div>
            <div className="relative bg-gray-900 border border-gray-800 rounded-3xl overflow-hidden">
              <div className="aspect-video bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-20 h-20 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4 cursor-pointer hover:scale-110 transition-transform shadow-2xl shadow-indigo-500/25">
                    <span className="text-3xl ml-1">▶️</span>
                  </div>
                  <p className="text-gray-400">Click to watch 2-minute demo</p>
                </div>
              </div>
            </div>
          </div>

          {/* Demo Features */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
            {[
              { icon: '⚡', label: 'Fast Processing' },
              { icon: '🎯', label: 'Accurate Results' },
              { icon: '🔒', label: 'Secure & Private' },
              { icon: '💰', label: 'Affordable Pricing' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 p-4 bg-gray-800/50 rounded-xl">
                <span className="text-2xl">{item.icon}</span>
                <span className="text-gray-300">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="relative z-10 py-32 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              How It
              <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent"> Works</span>
            </h2>
            <p className="text-gray-400 text-lg">Three simple steps to transform your content</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                title: 'Upload',
                description: 'Upload your photos or videos to our secure platform with drag-and-drop simplicity.',
                icon: '📤',
              },
              {
                step: '02',
                title: 'Transform',
                description: 'Select your desired AI transformation and let our algorithms work their magic.',
                icon: '⚡',
              },
              {
                step: '03',
                title: 'Download',
                description: 'Download your enhanced content in high resolution, ready to share with the world.',
                icon: '📥',
              },
            ].map((item, i) => (
              <div key={i} className="relative text-center p-8">
                <div className="text-6xl font-bold bg-gradient-to-br from-indigo-500/20 to-purple-500/20 bg-clip-text text-transparent mb-6">
                  {item.step}
                </div>
                <div className="w-16 h-16 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <span className="text-3xl">{item.icon}</span>
                </div>
                <h3 className="text-xl font-semibold mb-3">{item.title}</h3>
                <p className="text-gray-400">{item.description}</p>
                {i < 2 && (
                  <div className="hidden md:block absolute top-1/2 right-0 -translate-y-1/2 translate-x-1/2 text-gray-700">
                    →
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="relative z-10 py-32 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Simple
              <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent"> Pricing</span>
            </h2>
            <p className="text-gray-400 text-lg">Choose the plan that works best for you</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {pricingPlans.map((plan, i) => (
              <div
                key={i}
                className={`relative p-8 rounded-3xl border transition-all duration-300 hover:-translate-y-1 ${
                  plan.popular
                    ? 'bg-gradient-to-br from-indigo-600/20 to-purple-600/20 border-indigo-500/50 shadow-2xl shadow-indigo-500/20'
                    : 'bg-gray-900/50 border-gray-800 hover:border-gray-700'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full text-sm font-medium">
                    Most Popular
                  </div>
                )}
                <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                <div className="mb-6">
                  <span className="text-4xl font-bold">${plan.price}</span>
                  <span className="text-gray-500">/month</span>
                </div>
                <ul className="space-y-4 mb-8">
                  {plan.features.map((feature, j) => (
                    <li key={j} className="flex items-center gap-3 text-gray-300">
                      <span className="w-5 h-5 bg-green-500/20 rounded-full flex items-center justify-center">
                        <span className="text-green-400 text-xs">✓</span>
                      </span>
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link
                  to="/signup"
                  className={`block text-center py-3 rounded-xl font-medium transition-all ${
                    plan.popular
                      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-lg shadow-indigo-500/25'
                      : 'bg-gray-800 hover:bg-gray-700'
                  }`}
                >
                  Get Started
                </Link>
              </div>
            ))}
          </div>

          {/* Trust Badges */}
          <div className="flex flex-wrap items-center justify-center gap-8 mt-12 text-gray-500 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-green-400">✓</span>
              <span>30-Day Money Back</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-400">✓</span>
              <span>Cancel Anytime</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-400">✓</span>
              <span>SSL Secure Payment</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-400">✓</span>
              <span>24/7 Support</span>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="relative z-10 py-32 px-6 bg-gray-900/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Loved by
              <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent"> Creators</span>
            </h2>
            <p className="text-gray-400 text-lg">See what our users have to say</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, i) => (
              <div
                key={i}
                className="p-8 bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-3xl hover:border-gray-700 transition-all"
              >
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center">
                    <span className="text-xl">{testimonial.avatar}</span>
                  </div>
                  <div>
                    <div className="font-semibold">{testimonial.name}</div>
                    <div className="text-gray-500 text-sm">{testimonial.role}</div>
                  </div>
                </div>
                <p className="text-gray-300 leading-relaxed">"{testimonial.content}"</p>
                <div className="mt-4 flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <span key={star} className="text-yellow-400">★</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="relative z-10 py-32 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Frequently Asked
              <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent"> Questions</span>
            </h2>
            <p className="text-gray-400 text-lg">Everything you need to know about Persona Studio</p>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <div
                key={i}
                className="bg-gray-900/50 border border-gray-800 rounded-2xl overflow-hidden"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full p-6 text-left flex items-center justify-between hover:bg-gray-800/30 transition-colors"
                >
                  <span className="font-semibold text-white pr-4">{faq.question}</span>
                  <span className={`text-2xl text-gray-500 transition-transform ${openFaq === i ? 'rotate-45' : ''}`}>
                    +
                  </span>
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-6 text-gray-400 leading-relaxed">
                    {faq.answer}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Newsletter Section */}
      <section className="relative z-10 py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gradient-to-br from-indigo-600/20 to-purple-600/20 border border-indigo-500/30 rounded-3xl p-12 text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Stay Updated
            </h2>
            <p className="text-gray-400 mb-8 max-w-xl mx-auto">
              Get the latest AI tips, product updates, and exclusive offers delivered to your inbox. 
              Join 10,000+ creators.
            </p>
            
            {subscribed ? (
              <div className="flex items-center justify-center gap-2 text-green-400">
                <span className="text-xl">✓</span>
                <span className="font-medium">Thanks for subscribing!</span>
              </div>
            ) : (
              <form onSubmit={handleSubscribe} className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                  className="flex-1 px-6 py-4 bg-gray-900 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors"
                />
                <button
                  type="submit"
                  className="px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 rounded-xl font-medium transition-all shadow-lg shadow-indigo-500/25"
                >
                  Subscribe
                </button>
              </form>
            )}
            
            <p className="text-gray-600 text-sm mt-4">No spam. Unsubscribe anytime.</p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative z-10 py-32 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="p-12 bg-gradient-to-br from-indigo-600/20 to-purple-600/20 border border-indigo-500/30 rounded-3xl">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Ready to Transform?
            </h2>
            <p className="text-gray-400 text-lg mb-8 max-w-2xl mx-auto">
              Join thousands of creators using Persona Studio to bring their ideas to life. 
              Start with 10 free credits today.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to="/signup"
                className="group px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 rounded-2xl font-semibold text-lg transition-all shadow-2xl shadow-indigo-500/25 hover:shadow-indigo-500/40"
              >
                Start Free Trial
                <span className="inline-block ml-2 group-hover:translate-x-1 transition-transform">→</span>
              </Link>
              <Link
                to="/login"
                className="px-8 py-4 text-gray-400 hover:text-white transition-colors"
              >
                Sign In to Account
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-gray-800 py-16 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-5 gap-8 mb-12">
            {/* Brand */}
            <div className="md:col-span-2">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center">
                  <span className="text-xl">🎭</span>
                </div>
                <span className="text-xl font-bold">Persona Studio</span>
              </div>
              <p className="text-gray-500 text-sm mb-6 max-w-xs">
                AI-powered identity transformation platform for creators and professionals.
              </p>
              <div className="flex gap-4">
                <a href="#" className="w-10 h-10 bg-gray-800 hover:bg-gray-700 rounded-lg flex items-center justify-center transition-colors">
                  <span>🐦</span>
                </a>
                <a href="#" className="w-10 h-10 bg-gray-800 hover:bg-gray-700 rounded-lg flex items-center justify-center transition-colors">
                  <span>📸</span>
                </a>
                <a href="#" className="w-10 h-10 bg-gray-800 hover:bg-gray-700 rounded-lg flex items-center justify-center transition-colors">
                  <span>💼</span>
                </a>
                <a href="#" className="w-10 h-10 bg-gray-800 hover:bg-gray-700 rounded-lg flex items-center justify-center transition-colors">
                  <span>📺</span>
                </a>
              </div>
            </div>
            
            {/* Links */}
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-gray-500 text-sm">
                <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#pricing" className="hover:text-white transition-colors">Pricing</a></li>
                <li><a href="#demo" className="hover:text-white transition-colors">Demo</a></li>
                <li><Link to="/login" className="hover:text-white transition-colors">API Docs</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-gray-500 text-sm">
                <li><Link to="/about" className="hover:text-white transition-colors">About Us</Link></li>
                <li><Link to="/blog" className="hover:text-white transition-colors">Blog</Link></li>
                <li><Link to="/careers" className="hover:text-white transition-colors">Careers</Link></li>
                <li><Link to="/press" className="hover:text-white transition-colors">Press Kit</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Support</h4>
              <ul className="space-y-2 text-gray-500 text-sm">
                <li><Link to="/help" className="hover:text-white transition-colors">Help Center</Link></li>
                <li><Link to="/contact" className="hover:text-white transition-colors">Contact Us</Link></li>
                <li><Link to="/status" className="hover:text-white transition-colors">Status Page</Link></li>
                <li><Link to="/community" className="hover:text-white transition-colors">Community</Link></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-gray-500 text-sm">
              © 2026 Persona Studio. All rights reserved.
            </p>
            <div className="flex gap-6 text-gray-500 text-sm">
              <Link to="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
              <Link to="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
              <Link to="/cookies" className="hover:text-white transition-colors">Cookie Policy</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
