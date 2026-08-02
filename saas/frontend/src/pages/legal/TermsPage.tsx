import React from 'react';
import { Link } from 'react-router-dom';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
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
          <h1 className="text-3xl font-bold text-white mb-2">Terms of Service</h1>
          <p className="text-gray-400">Last updated: August 1, 2026</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 space-y-8">
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">1. Acceptance of Terms</h2>
            <p className="text-gray-300 leading-relaxed">
              By accessing and using Persona Studio ("the Service"), you agree to be bound by these Terms of Service.
              If you do not agree to these terms, please do not use the Service. We reserve the right to modify these
              terms at any time, and your continued use of the Service constitutes acceptance of any changes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">2. Description of Service</h2>
            <p className="text-gray-300 leading-relaxed">
              Persona Studio provides AI-powered identity transformation tools including but not limited to face swapping,
              voice cloning, portrait animation, background removal, and image filtering. The Service is provided "as is"
              and may be modified, updated, or discontinued at any time without notice.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">3. User Accounts</h2>
            <div className="text-gray-300 leading-relaxed space-y-3">
              <p>To use certain features, you must create an account. You agree to:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Provide accurate, current, and complete information during registration</li>
                <li>Maintain the security of your password and account credentials</li>
                <li>Promptly update your account information if it changes</li>
                <li>Accept responsibility for all activities that occur under your account</li>
                <li>Notify us immediately of any unauthorized use of your account</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">4. Acceptable Use Policy</h2>
            <div className="text-gray-300 leading-relaxed space-y-3">
              <p>You agree not to use the Service to:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Create deepfakes or misleading content intended to deceive or harm others</li>
                <li>Violate any applicable laws, regulations, or third-party rights</li>
                <li>Impersonate any person or entity, or falsely claim affiliation</li>
                <li>Upload malicious code, viruses, or other harmful content</li>
                <li>Attempt to gain unauthorized access to other user accounts or systems</li>
                <li>Use the Service for commercial purposes without proper authorization</li>
                <li>Reverse engineer, decompile, or attempt to extract the source code of the Service</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">5. Content Ownership</h2>
            <p className="text-gray-300 leading-relaxed">
              You retain ownership of any content you upload to the Service. By uploading content, you grant Persona
              Studio a limited, non-exclusive license to process, store, and transmit your content solely for the
              purpose of providing the Service. We will not use your content for any other purpose without your explicit
              consent.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">6. Credits and Payments</h2>
            <div className="text-gray-300 leading-relaxed space-y-3">
              <p>The Service operates on a credit-based system:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Credits are purchased in packages and are non-refundable once used</li>
                <li>Each AI transformation consumes a specific number of credits as listed in the pricing section</li>
                <li>Credits do not expire as long as your account remains active</li>
                <li>We reserve the right to adjust pricing with 30 days' notice</li>
                <li>Refund requests are handled on a case-by-case basis within 14 days of purchase</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">7. Intellectual Property</h2>
            <p className="text-gray-300 leading-relaxed">
              All content, features, and functionality of the Service, including but not limited to text, graphics,
              logos, icons, images, data compilations, software, and AI models, are the exclusive property of Persona
              Studio or its licensors and are protected by copyright, trademark, and other intellectual property laws.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">8. Limitation of Liability</h2>
            <p className="text-gray-300 leading-relaxed">
              To the maximum extent permitted by law, Persona Studio shall not be liable for any indirect, incidental,
              special, consequential, or punitive damages, or any loss of profits or revenues, whether incurred directly
              or indirectly, or any loss of data, use, goodwill, or other intangible losses resulting from your use of
              the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">9. Indemnification</h2>
            <p className="text-gray-300 leading-relaxed">
              You agree to indemnify, defend, and hold harmless Persona Studio, its officers, directors, employees,
              agents, and affiliates from any claims, liabilities, damages, losses, and expenses (including reasonable
              attorneys' fees) arising from your use of the Service or violation of these Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">10. Termination</h2>
            <p className="text-gray-300 leading-relaxed">
              We may terminate or suspend your account and access to the Service at our sole discretion, without notice,
              for conduct that we believe violates these Terms or is harmful to other users, us, or third parties, or
              for any other reason. Upon termination, your right to use the Service ceases immediately.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">11. Governing Law</h2>
            <p className="text-gray-300 leading-relaxed">
              These Terms shall be governed by and construed in accordance with applicable laws, without regard to
              conflict of law principles. Any disputes arising under these Terms shall be resolved in the appropriate
              courts of the applicable jurisdiction.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">12. Changes to Terms</h2>
            <p className="text-gray-300 leading-relaxed">
              We reserve the right to modify these Terms at any time. We will notify you of any material changes by
              posting the new Terms on this page and updating the "Last updated" date. Your continued use of the Service
              after such changes constitutes your acceptance of the new Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">13. Contact Us</h2>
            <p className="text-gray-300 leading-relaxed">
              If you have any questions about these Terms, please contact us at{' '}
              <Link to="/contact" className="text-indigo-400 hover:text-indigo-300">support@personastudio.ai</Link>{' '}
              or visit our <Link to="/contact" className="text-indigo-400 hover:text-indigo-300">Contact page</Link>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
