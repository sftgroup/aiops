import { ReactNode, useState, useEffect } from 'react';
import { Check, X, CreditCard, Wallet, Link2, Loader2, CheckCircle, Copy } from 'lucide-react';
import { getToken } from '../../token';
import { useAuth } from '../../AuthContext';

interface PricingCardProps {
  name: string;
  price: string;
  features: string[];
  ctaText: string;
  ctaLink?: string;
  planId?: string;
  highlighted?: boolean;
  icon?: ReactNode;
}

type PaymentMethod = 'stripe' | 'crypto';

interface ChainOption {
  id: string;
  name: string;
  chainId: string;
  icon: string;
  color: string;
  enabled: boolean;
}

interface CryptoOrder {
  orderId: string;
  chain: string;
  chainName: string;
  chainId: string;
  rpcUrl: string;
  explorer: string;
  tokenAddress: string;
  tokenSymbol: string;
  nativeSymbol: string;
  paymentAddress: string;
  amount: number;
  baseAmount: number;
  expiresAt: string;
}

export default function PricingCard({
  name,
  price,
  features,
  ctaText,
  ctaLink,
  planId,
  highlighted = false,
  icon,
}: PricingCardProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>('crypto');
  const [step, setStep] = useState<'select' | 'chains' | 'processing' | 'done' | 'manual'>('select');
  const [selectedChain, setSelectedChain] = useState('sepolia');
  const [chains, setChains] = useState<ChainOption[]>([]);
  const [order, setOrder] = useState<CryptoOrder | null>(null);
  const [txHash, setTxHash] = useState('');
  const [copied, setCopied] = useState(false);
  const [connectingWallet, setConnectingWallet] = useState(false);

  const hasWallet = !!user?.walletAddress;
  const eth = (window as any).ethereum;

  // Fetch available chains on mount
  useEffect(() => {
    fetch('/api/billing/chains')
      .then(r => r.json())
      .then(d => {
        const list = Object.entries(d.chains || {}).map(([id, c]: [string, any]) => ({
          id,
          name: c.name,
          chainId: c.chainId,
          icon: c.icon || '⛓️',
          color: c.color || '#666',
          enabled: c.enabled,
        }));
        setChains(list);
      })
      .catch(() => {}); // UI won't break if chains fetch fails
  }, []);

  const handleCTA = () => {
    if (ctaLink) { window.location.href = ctaLink; return; }
    if (!planId) return;
    setShowModal(true);
    setError('');
    setMethod(hasWallet ? 'crypto' : 'stripe');
    setStep(hasWallet ? 'chains' : 'select');
    setOrder(null);
    setTxHash('');
    setSelectedChain('sepolia');
  };

  const handleStripe = async () => {
    setLoading(true);
    setError('');
    try {
      const token = getToken();
      const r = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan: planId }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Payment failed');
      if (d.url) window.location.href = d.url;
      else setError('Payment system not available. Please try again later.');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleWalletPay = async () => {
    setLoading(true);
    setError('');
    setStep('processing');

    try {
      const token = getToken();

      // 1. Create order on selected chain
      const r1 = await fetch('/api/billing/crypto-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ planId, chain: selectedChain }),
      });
      const d1 = await r1.json();
      if (!r1.ok) throw new Error(d1.error || 'Failed to create order');
      setOrder(d1);

      // 2. Check wallet
      if (!eth) {
        setStep('manual');
        setLoading(false);
        return;
      }

      const accounts = await eth.request({ method: 'eth_requestAccounts' });
      if (!accounts?.[0]) throw new Error('Wallet connection rejected.');

      // 3. Switch chain
      try {
        await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: d1.chainId }] });
      } catch (swErr: any) {
        if (swErr.code === 4902) {
          await eth.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: d1.chainId,
              chainName: d1.chainName,
              rpcUrls: [d1.rpcUrl],
              nativeCurrency: { name: d1.nativeSymbol, symbol: d1.nativeSymbol, decimals: 18 },
            }],
          });
        } else {
          throw swErr;
        }
      }

      // 4. ERC20 transfer (let MetaMask auto-estimate gas)
      const amountWei = '0x' + BigInt(Math.floor(d1.amount * 1e6)).toString(16);
      const transferSig = '0xa9059cbb';
      const toEncoded = d1.paymentAddress.slice(2).padStart(64, '0');
      const amountEncoded = amountWei.slice(2).padStart(64, '0');
      const data = transferSig + toEncoded + amountEncoded;

      const txHashResult = await eth.request({
        method: 'eth_sendTransaction',
        params: [{
          from: accounts[0],
          to: d1.tokenAddress,
          data,
          value: '0x0',
        }],
      });

      setTxHash(txHashResult);

      // 5. Notify backend
      await fetch('/api/billing/crypto-confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ orderId: d1.orderId, txHash: txHashResult }),
      });

      setStep('done');
    } catch (e: any) {
      console.error('[wallet-pay]', e);
      if (e.code === 4001) {
        setError('Transaction rejected in wallet.');
        setLoading(false);
        return; // Don't fallback to manual — user explicitly rejected
      } else if (e.code === -32002 || e.message?.includes('already pending')) {
        setError('Please check MetaMask for a pending request.');
      } else if (e.message?.includes('insufficient funds') || e.message?.includes('insufficient balance')) {
        setError(e.message || 'Insufficient balance. Please check your wallet.');
      } else {
        setError(e.message || 'Transaction failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleManualCopy = async () => {
    if (order) {
      await navigator.clipboard.writeText(order.paymentAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleConnectWallet = async () => {
    setConnectingWallet(true);
    setError('');
    try {
      if (!eth) throw new Error('No wallet detected. Please install MetaMask or another Web3 wallet.');
      const accounts = await eth.request({ method: 'eth_requestAccounts' });
      if (!accounts?.[0]) throw new Error('Wallet connection rejected.');
      const address = accounts[0].toLowerCase();
      const message = `Connect wallet to Aiops\nAddress: ${address}\nNonce: ${Date.now()}`;
      const signature = await eth.request({
        method: 'personal_sign',
        params: [message, address],
      });
      const token = getToken();
      const r = await fetch('/api/auth/wallet-bind', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ walletAddress: address, message, signature }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Binding failed.');
      window.location.reload();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setConnectingWallet(false);
    }
  };

  return (
    <>
      <div
        className={`relative group rounded-2xl border transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl ${
          highlighted
            ? 'bg-gradient-to-b from-dark-card via-dark-card to-dark-card/90 border-accent-primary/50 shadow-lg shadow-accent-primary/20'
            : 'bg-dark-card border-dark-border hover:border-accent-primary/30'
        }`}
      >
        <div className="p-6 sm:p-8 flex flex-col h-full">
          <div className="mb-6 flex items-center gap-3">
            {icon && <span className="text-accent-primary">{icon}</span>}
            <h3 className={`text-xl font-bold ${highlighted ? 'text-accent-primary' : 'text-white'}`}>
              {name}
            </h3>
          </div>
          <div className="mb-6">
            <span className="text-[3rem] font-bold text-white leading-none">{price}</span>
          </div>
          <ul className="space-y-3 mb-8 flex-1">
            {features.map((f, i) => (
              <li key={i} className="flex items-start gap-3">
                <Check size={16} className="text-accent-primary shrink-0 mt-0.5" />
                <span className="text-sm text-gray-400">{f}</span>
              </li>
            ))}
          </ul>
          {error && <p className="text-xs text-red-400 mb-2">{error}</p>}
          <button
            onClick={handleCTA}
            className={`w-full py-3 rounded-xl text-sm font-medium transition-all active:scale-95 ${
              highlighted
                ? 'bg-accent-primary hover:bg-accent-primary/90 text-white shadow-lg shadow-accent-primary/20'
                : 'bg-dark-bg border border-dark-border text-gray-300 hover:border-accent-primary/50 hover:text-white'
            }`}
          >
            {ctaText}
          </button>
        </div>
      </div>

      {/* ─── Modal ─── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowModal(false)} />
          <div className="relative bg-dark-card border border-dark-border rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <button onClick={() => setShowModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white">
              <X size={20} />
            </button>

            {/* ── Step: Select method ── */}
            {step === 'select' && (
              <>
                <h2 className="text-lg font-bold text-white mb-1">{name} — Upgrade</h2>
                <p className="text-sm text-gray-400 mb-6">Select payment method</p>

                <label className="flex items-center gap-4 p-4 rounded-xl border border-accent-primary bg-accent-primary/5 cursor-pointer mb-3">
                  <input type="radio" name="pm" value="stripe" checked readOnly className="accent-accent-primary w-4 h-4" />
                  <CreditCard size={22} className="text-gray-400" />
                  <div>
                    <div className="text-white text-sm font-medium">Credit Card (Stripe)</div>
                    <div className="text-gray-400 text-xs">Visa, Mastercard, etc.</div>
                  </div>
                </label>

                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-4">
                  <div className="flex items-start gap-3">
                    <Link2 size={18} className="text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm text-amber-400 font-medium mb-1">Connect your wallet for crypto payment</p>
                      <p className="text-xs text-amber-400/70 mb-3">
                        Bind a wallet to your account and pay directly with crypto on 5+ chains.
                      </p>
                      <button
                        onClick={handleConnectWallet}
                        disabled={connectingWallet}
                        className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                      >
                        <Wallet size={14} />
                        {connectingWallet ? 'Connecting...' : 'Connect Wallet'}
                      </button>
                    </div>
                  </div>
                </div>

                {error && <p className="text-xs text-red-400 mt-3 mb-3">{error}</p>}

                <button
                  onClick={handleStripe}
                  disabled={loading || connectingWallet}
                  className="w-full mt-1 bg-accent-primary hover:bg-accent-primary/90 text-white py-3 rounded-xl text-sm font-medium transition-all disabled:opacity-50"
                >
                  {loading ? 'Processing...' : 'Continue with Stripe'}
                </button>
              </>
            )}

            {/* ── Step: Select chain ── */}
            {step === 'chains' && (
              <>
                <h2 className="text-lg font-bold text-white mb-1">Select Network</h2>
                <p className="text-sm text-gray-400 mb-4">Choose which chain to pay on</p>

                <div className="space-y-2 mb-4">
                  {chains.length === 0 && (
                    <p className="text-sm text-gray-500 text-center py-4">Loading networks...</p>
                  )}
                  {chains.map(c => (
                    <label
                      key={c.id}
                      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                        selectedChain === c.id
                          ? 'border-accent-primary bg-accent-primary/5'
                          : 'border-dark-border hover:border-gray-600'
                      }`}
                      style={{ borderLeftColor: selectedChain === c.id ? c.color : undefined, borderLeftWidth: selectedChain === c.id ? '3px' : '1px' }}
                    >
                      <input
                        type="radio"
                        name="chain"
                        value={c.id}
                        checked={selectedChain === c.id}
                        onChange={() => setSelectedChain(c.id)}
                        className="accent-accent-primary w-4 h-4"
                      />
                      <span className="text-xl">{c.icon}</span>
                      <div className="flex-1">
                        <div className="text-white text-sm font-medium">{c.name}</div>
                        <div className="text-gray-500 text-xs">{c.id}</div>
                      </div>
                    </label>
                  ))}
                </div>

                <div className="flex gap-2 mb-4">
                  <button
                    onClick={() => { setStep('select'); setMethod('stripe'); }}
                    className="flex-1 bg-dark-bg border border-dark-border text-gray-300 py-3 rounded-xl text-sm font-medium hover:border-gray-600"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => {
                      if (hasWallet) {
                        setMethod('crypto');
                        handleWalletPay();
                      } else {
                        setStep('select');
                      }
                    }}
                    disabled={!selectedChain || loading}
                    className="flex-1 bg-accent-primary hover:bg-accent-primary/90 text-white py-3 rounded-xl text-sm font-medium transition-all disabled:opacity-50"
                  >
                    Pay with Wallet
                  </button>
                </div>

                {error && <p className="text-xs text-red-400">{error}</p>}
              </>
            )}

            {/* ── Step: Processing ── */}
            {step === 'processing' && (
              <div className="text-center py-6">
                <Loader2 size={40} className="text-accent-primary animate-spin mx-auto mb-4" />
                <h2 className="text-lg font-bold text-white mb-2">Confirm in Wallet</h2>
                <p className="text-sm text-gray-400 mb-4">
                  Please confirm the transaction in MetaMask to send{' '}
                  <span className="text-white font-mono">{order?.amount} {order?.tokenSymbol}</span> on{' '}
                  <span className="text-white">{order?.chainName}</span>.
                </p>
                <p className="text-xs text-gray-500">Do not close this window.</p>
                {error && (
                  <>
                    <p className="text-xs text-red-400 mt-4">{error}</p>
                    <button
                      onClick={() => { setError(''); setStep('manual'); }}
                      className="w-full mt-3 bg-dark-bg border border-dark-border text-white py-3 rounded-xl text-sm font-medium hover:border-gray-600"
                    >
                      Show address instead
                    </button>
                  </>
                )}
              </div>
            )}

            {/* ── Step: Done ── */}
            {step === 'done' && (
              <div className="text-center py-4">
                <CheckCircle size={48} className="text-green-400 mx-auto mb-4" />
                <h2 className="text-lg font-bold text-white mb-2">Transaction Submitted!</h2>
                <p className="text-sm text-gray-400 mb-4">
                  Your upgrade is being processed on <span className="text-white">{order?.chainName}</span>. It may take a few minutes to confirm.
                </p>
                {txHash && (
                  <div className="bg-dark-bg rounded-xl p-3 mb-4">
                    <a
                      href={`${order?.explorer}/tx/${txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="break-all text-xs font-mono text-green-400 hover:underline"
                    >
                      TX: {txHash}
                    </a>
                  </div>
                )}
                <p className="text-xs text-gray-500 mb-4">Order ID: {order?.orderId}</p>
                <button
                  onClick={() => setShowModal(false)}
                  className="w-full bg-accent-primary hover:bg-accent-primary/90 text-white py-3 rounded-xl text-sm font-medium"
                >
                  Done
                </button>
              </div>
            )}

            {/* ── Step: Manual fallback ── */}
            {step === 'manual' && order && (
              <>
                <h2 className="text-lg font-bold text-white mb-1">
                  <span>{chains.find(c => c.id === order.chain)?.icon}</span>{' '}
                  Send USDC on {order.chainName}
                </h2>
                <p className="text-sm text-gray-400 mb-4">
                  Transfer exactly <span className="text-white font-mono">{order.amount} USDC</span> to:
                </p>

                <div className="bg-dark-bg rounded-xl p-3 mb-3 break-all text-sm font-mono text-green-400 flex items-start gap-2">
                  <span className="flex-1">{order.paymentAddress}</span>
                  <button onClick={handleManualCopy} className="shrink-0 text-gray-400 hover:text-white">
                    {copied ? <CheckCircle size={16} className="text-green-400" /> : <Copy size={16} />}
                  </button>
                </div>

                <p className="text-xs text-gray-500 mb-1">Network: {order.chainName}</p>
                <p className="text-xs text-gray-500 mb-4">Order ID: <code className="text-gray-400">{order.orderId}</code></p>

                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 mb-4">
                  <p className="text-xs text-amber-400">
                    Send the exact amount — the decimal digits encode your order ID for automatic matching.
                  </p>
                </div>

                <p className="text-xs text-gray-500 mb-4">
                  Expires: {new Date(order.expiresAt).toLocaleString()}
                </p>

                <button
                  onClick={() => setShowModal(false)}
                  className="w-full bg-dark-bg border border-dark-border text-white py-3 rounded-xl text-sm font-medium hover:border-gray-600"
                >
                  Close
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
