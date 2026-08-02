import React from 'react';
import { Link } from 'react-router-dom';

export default function CookiePolicyPage() {
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
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Cookie Policy</h1>
          <p className="text-gray-400">Last updated: August 1, 2026</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 space-y-8">
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">1. What Are Cookies</h2>
            <p className="text-gray-300 leading-relaxed">
              Cookies are small text files that are stored on your device when you visit a website. They are widely
              used to make websites work efficiently and provide information to website owners. This Cookie Policy
              explains how Persona Studio uses cookies and similar technologies.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">2. How We Use Cookies</h2>
            <p className="text-gray-300 leading-relaxed">
              We use cookies for the following purposes:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4 text-gray-300 mt-3">
              <li><strong>Authentication:</strong> To keep you logged in and maintain your session</li>
              <li><strong>Security:</strong> To protect against CSRF attacks and unauthorized access</li>
              <li><strong>Preferences:</strong> To remember your settings and preferences</li>
              <li><strong>Analytics:</strong> To understand how you use the Service and improve it</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">3. Types of Cookies We Use</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="py-3 px-4 text-white font-semibold">Type</th>
                    <th className="py-3 px-4 text-white font-semibold">Purpose</th>
                    <th className="py-3 px-4 text-white font-semibold">Duration</th>
                  </tr>
                </thead>
                <tbody className="text-gray-300">
                  <tr className="border-b border-gray-800">
                    <td className="py-3 px-4">Essential</td>
                    <td className="py-3 px-4">Required for authentication and security</td>
                    <td className="py-3 px-4">Session / 30 days</td>
                  </tr>
                  <tr className="border-b border-gray-800">
                    <td className="py-3 px-4">Functional</td>
                    <td className="py-3 px-4">Remember your preferences and settings</td>
                    <td className="py-3 px-4">1 year</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4">Analytics</td>
                    <td className="py-3 px-4">Understand usage patterns (anonymized)</td>
                    <td className="py-3 px-4">2 years</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">4. Third-Party Cookies</h2>
            <p className="text-gray-300 leading-relaxed">
              We do not use third-party advertising cookies or tracking cookies. Our analytics are performed using
              privacy-focused, anonymized data collection. We do not share cookie data with advertisers or use it
              for targeted advertising.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">5. Managing Cookies</h2>
            <div className="text-gray-300 leading-relaxed space-y-3">
              <p>You can control and manage cookies through your browser settings:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong>Chrome:</strong> Settings → Privacy and Security → Cookies</li>
                <li><strong>Firefox:</strong> Settings → Privacy & Security → Cookies and Site Data</li>
                <li><strong>Safari:</strong> Preferences → Privacy → Manage Website Data</li>
                <li><strong>Edge:</strong> Settings → Privacy, Search, and Services → Cookies</li>
              </ul>
              <p className="mt-3">
                Note: Disabling essential cookies may affect the functionality of the Service, including your ability
                to log in and use AI features.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">6. Local Storage</h2>
            <p className="text-gray-300 leading-relaxed">
              We use browser local storage to store your authentication tokens and preferences. This data is stored
              on your device and is not sent to our servers. You can clear local storage through your browser settings.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">7. Changes to This Policy</h2>
            <p className="text-gray-300 leading-relaxed">
              We may update this Cookie Policy from time to time. Any changes will be posted on this page with an
              updated "Last updated" date.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">8. Contact Us</h2>
            <p className="text-gray-300 leading-relaxed">
              If you have questions about our use of cookies, please contact us at{' '}
              <Link to="/contact" className="text-indigo-400 hover:text-indigo-300">privacy@personastudio.ai</Link>{' '}
              or visit our <Link to="/contact" className="text-indigo-400 hover:text-indigo-300">Contact page</Link>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
