import React, { useEffect, useState } from 'react';
import api from '../api';
import { useAuth } from '../contexts/AuthContext';

interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  price_usd: number;
  price_usdt: number;
  bonus_credits: number;
}

interface PaymentInfo {
  transaction_id: string;
  payment: {
    address: string;
    amount_usd: number;
    memo: string;
    network: string;
  };
  amount: number;
}

export default function CreditsPage() {
  const { user, refreshUser } = useAuth();
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo | null>(null);
  const [txHash, setTxHash] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState<'packages' | 'history'>('packages');
  const [transactions, setTransactions] = useState<any[]>([]);

  useEffect(() => {
    api.get('/api/credits/packages').then(res => setPackages(res.data.packages));
  }, []);

  useEffect(() => {
    if (activeTab === 'history') {
      api.get('/api/user/transactions?limit=50').then(res => setTransactions(res.data.transactions || [])).catch(() => {});
    }
  }, [activeTab]);

  const selectedPackage = packages.find(p => p.id === selected);

  const handlePurchase = async () => {
    if (!selected) return;
    setLoading(true);
    try {
      const res = await api.post('/api/credits/purchase', {
        package_id: selected,
        payment_method: 'USDT-TRC20',
      });
      setPaymentInfo(res.data);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Purchase failed');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!txHash) return;
    setLoading(true);
    try {
      const res = await api.post('/api/credits/confirm', { tx_hash: txHash });
      setSuccess(`Payment confirmed! ${res.data.credits_added} credits added to your account.`);
      setPaymentInfo(null);
      setTxHash('');
      refreshUser();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Confirmation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Buy Credits</h1>
        <p className="text-gray-400 mt-1">Purchase credits to use AI features</p>
      </div>

      {/* Current Balance */}
      <div className="bg-gradient-to-br from-indigo-600/20 to-purple-600/20 border border-indigo-500/30 rounded-2xl p-4 sm:p-6 mb-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-400 text-sm">Current Balance</p>
            <p className="text-3xl sm:text-4xl font-bold text-white mt-1">{user?.credits || 0} <span className="text-lg text-gray-400">credits</span></p>
            <p className="text-sm text-gray-500 mt-2">≈ ${((user?.credits || 0) * 0.2).toFixed(2)} value</p>
          </div>
          <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-2xl flex items-center justify-center shadow-lg">
            <span className="text-3xl">💎</span>
          </div>
        </div>
      </div>

      {/* Success Message */}
      {success && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 mb-6 flex items-center gap-3">
          <span className="text-xl">✅</span>
          <p className="text-green-400">{success}</p>
          <button onClick={() => setSuccess('')} className="ml-auto text-green-400 hover:text-green-300">✕</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('packages')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
            activeTab === 'packages' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }`}
        >
          💎 Buy Credits
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
            activeTab === 'history' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }`}
        >
          📜 Purchase History
        </button>
      </div>

      {!paymentInfo ? (
        <>
          {activeTab === 'packages' ? (
            <>
              {/* Credit Packages */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {packages.map((pkg) => {
                  const perCredit = (pkg.price_usd / pkg.credits).toFixed(2);
                  const isPopular = pkg.credits >= 500;
                  return (
                    <div
                      key={pkg.id}
                      onClick={() => setSelected(pkg.id)}
                      className={`relative bg-gray-900 rounded-2xl p-6 border-2 cursor-pointer transition-all hover:-translate-y-1 ${
                        selected === pkg.id
                          ? 'border-indigo-500 shadow-xl shadow-indigo-500/20'
                          : 'border-gray-800 hover:border-gray-700'
                      }`}
                    >
                      {isPopular && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full text-xs font-medium text-white">
                          Best Value
                        </div>
                      )}
                      
                      <div className="text-center">
                        <h3 className="text-lg font-semibold text-white">{pkg.name}</h3>
                        
                        <div className="mt-4">
                          <span className="text-4xl font-bold text-white">{pkg.credits}</span>
                          <span className="text-gray-400 ml-1">credits</span>
                        </div>
                        
                        {pkg.bonus_credits > 0 && (
                          <div className="mt-2 inline-flex items-center gap-1 px-2 py-1 bg-green-500/20 rounded-lg">
                            <span className="text-green-400 text-sm">+{pkg.bonus_credits} bonus</span>
                          </div>
                        )}
                        
                        <div className="mt-4 pt-4 border-t border-gray-800">
                          <p className="text-2xl font-bold text-indigo-400">${pkg.price_usd}</p>
                          <p className="text-xs text-gray-500 mt-1">${perCredit}/credit</p>
                        </div>
                        
                        <p className="text-xs text-gray-500 mt-2">
                          or {pkg.price_usdt} USDT
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Payment Methods */}
              <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 mb-6">
                <h2 className="text-lg font-semibold text-white mb-4">Supported Payment Methods</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { name: 'USDT (TRC20)', icon: '💵', network: 'Tron' },
                    { name: 'USDT (ERC20)', icon: '💵', network: 'Ethereum' },
                    { name: 'USDT (BEP20)', icon: '💵', network: 'BSC' },
                    { name: 'USDC (ERC20)', icon: '💰', network: 'Ethereum' },
                  ].map((method) => (
                    <div key={method.name} className="p-4 bg-gray-800/50 rounded-xl text-center hover:bg-gray-800 transition-colors cursor-pointer">
                      <span className="text-2xl block mb-2">{method.icon}</span>
                      <p className="text-white text-sm font-medium">{method.name}</p>
                      <p className="text-xs text-gray-500">{method.network}</p>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-4">
                  🔒 Payments are processed securely. Your wallet address is generated unique for each transaction.
                </p>
              </div>

              {/* Purchase Button */}
              <button
                onClick={handlePurchase}
                disabled={!selected || loading}
                className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-indigo-500/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                    Processing...
                  </>
                ) : (
                  <>
                    Continue to Payment
                    {selectedPackage && (
                      <span className="ml-2 text-white/70">
                        (${selectedPackage.price_usd})
                      </span>
                    )}
                  </>
                )}
              </button>

              {/* Trust Badges */}
              <div className="flex flex-wrap items-center justify-center gap-6 mt-6 text-gray-500 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-green-400">✓</span>
                  <span>Instant Delivery</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-green-400">✓</span>
                  <span>Secure Payment</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-green-400">✓</span>
                  <span>24/7 Support</span>
                </div>
              </div>
            </>
          ) : (
            /* Purchase History */
            <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6">
              {transactions.length === 0 ? (
                <div className="text-center py-12">
                  <span className="text-4xl mb-4 block">📜</span>
                  <p className="text-gray-400">No purchases yet</p>
                  <p className="text-gray-500 text-sm mt-2">Your purchase history will appear here</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {transactions.map((tx: any) => (
                    <div key={tx.id} className="flex items-center gap-4 p-4 bg-gray-800/50 rounded-xl">
                      <div className="w-10 h-10 bg-green-500/20 rounded-xl flex items-center justify-center">
                        <span className="text-lg">💰</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium">{tx.description || 'Credit Purchase'}</p>
                        <p className="text-xs text-gray-500">{new Date(tx.created_at).toLocaleString()}</p>
                      </div>
                      <div className="text-right">
                        <p className={`font-medium ${tx.amount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {tx.amount > 0 ? '+' : ''}{tx.amount} credits
                        </p>
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          tx.status === 'confirmed' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                        }`}>{tx.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        /* Payment Instructions */
        <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
          {/* Payment Header */}
          <div className="p-6 bg-gradient-to-r from-indigo-600/20 to-purple-600/20 border-b border-gray-800">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-white">Complete Payment</h2>
                <p className="text-gray-400 mt-1">Send the exact amount to the address below</p>
              </div>
              <button
                onClick={() => { setPaymentInfo(null); setTxHash(''); }}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Amount */}
            <div className="bg-gray-800 rounded-xl p-4">
              <p className="text-sm text-gray-400 mb-1">Send exactly</p>
              <p className="text-3xl font-bold text-white">{paymentInfo.payment.amount_usd} USDT</p>
              <p className="text-sm text-gray-500 mt-1">≈ {paymentInfo.amount} credits</p>
            </div>

            {/* Network */}
            <div className="bg-gray-800 rounded-xl p-4">
              <p className="text-sm text-gray-400 mb-2">Network</p>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 bg-indigo-500/20 text-indigo-400 rounded-lg text-sm font-medium">
                  {paymentInfo.payment.network || 'TRC20'}
                </span>
                <span className="text-yellow-400 text-sm">⚠️ Use correct network</span>
              </div>
            </div>

            {/* Address */}
            <div className="bg-gray-800 rounded-xl p-4">
              <p className="text-sm text-gray-400 mb-2">Send to address</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-sm text-white break-all bg-gray-900 p-3 rounded-lg">
                  {paymentInfo.payment.address}
                </code>
                <button
                  onClick={() => handleCopy(paymentInfo.payment.address)}
                  className="px-4 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg text-white transition-colors"
                >
                  📋 Copy
                </button>
              </div>
            </div>

            {/* Memo */}
            {paymentInfo.payment.memo && (
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
                <p className="text-sm text-yellow-400 mb-2">⚠️ Important: Include this memo</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-lg font-mono text-white bg-gray-900 p-3 rounded-lg">
                    {paymentInfo.payment.memo}
                  </code>
                  <button
                    onClick={() => handleCopy(paymentInfo.payment.memo)}
                    className="px-4 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg text-white transition-colors"
                  >
                    📋 Copy
                  </button>
                </div>
                <p className="text-xs text-yellow-400/70 mt-2">Without memo, payment may not be credited automatically</p>
              </div>
            )}

            {/* Transaction Hash Input */}
            <div className="border-t border-gray-800 pt-6">
              <p className="text-sm text-gray-400 mb-3">After sending payment, enter your transaction hash:</p>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={txHash}
                  onChange={(e) => setTxHash(e.target.value)}
                  placeholder="Transaction hash (0x...)"
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-indigo-500"
                />
                <button
                  onClick={handleConfirm}
                  disabled={!txHash || loading}
                  className="px-6 py-3 bg-green-600 hover:bg-green-500 text-white font-medium rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {loading ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                  ) : (
                    '✓'
                  )}
                  Confirm
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">Payment will be confirmed after network confirmations</p>
            </div>

            {/* Cancel */}
            <button
              onClick={() => { setPaymentInfo(null); setTxHash(''); }}
              className="w-full py-3 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-xl transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
