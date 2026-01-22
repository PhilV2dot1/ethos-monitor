'use client';

import { useState } from 'react';
import {
  ExternalLink,
  Copy,
  CheckCircle,
  LogIn,
  Key,
  Info,
  Loader2,
} from 'lucide-react';

interface EthosLoginProps {
  onTokenUpdate: (token: string) => Promise<void>;
  currentTokenValid: boolean;
}

export default function EthosLogin({ onTokenUpdate, currentTokenValid }: EthosLoginProps) {
  const [step, setStep] = useState<'idle' | 'login' | 'extract' | 'paste'>('idle');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const bookmarkletCode = `javascript:(function(){const t=document.cookie.split(';').find(c=>c.trim().startsWith('privy-token='));if(t){const v=t.split('=')[1];navigator.clipboard.writeText(v);alert('Token copied!');}else{alert('No token found. Please log in first.');}})();`;

  const handleOpenEthos = () => {
    window.open('https://app.ethos.network', '_blank', 'width=500,height=700');
    setStep('login');
  };

  const handleCopyBookmarklet = () => {
    navigator.clipboard.writeText(bookmarkletCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmitToken = async () => {
    if (!token.trim()) return;
    setLoading(true);
    try {
      await onTokenUpdate(token.trim());
      setToken('');
      setStep('idle');
    } catch (error) {
      console.error('Failed to update token:', error);
    } finally {
      setLoading(false);
    }
  };

  if (currentTokenValid) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl p-6 text-white">
      <div className="flex items-center gap-3 mb-4">
        <LogIn className="w-8 h-8" />
        <div>
          <h3 className="text-xl font-bold">Connect to Ethos</h3>
          <p className="text-indigo-100 text-sm">Required for posting defense reviews</p>
        </div>
      </div>

      {step === 'idle' && (
        <div className="space-y-4">
          <p className="text-indigo-100">
            To defend your relations, you need to connect your Ethos account.
          </p>
          <button
            onClick={handleOpenEthos}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-white text-indigo-600 rounded-xl font-semibold hover:bg-indigo-50 transition-colors"
          >
            <ExternalLink className="w-5 h-5" />
            Open Ethos Network
          </button>
        </div>
      )}

      {step === 'login' && (
        <div className="space-y-4">
          <div className="bg-white/10 rounded-xl p-4">
            <h4 className="font-semibold mb-2 flex items-center gap-2">
              <span className="bg-white text-indigo-600 rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">1</span>
              Log in to Ethos
            </h4>
            <p className="text-indigo-100 text-sm">
              If a popup opened, log in with your wallet. If not, click the button above again.
            </p>
          </div>

          <button
            onClick={() => setStep('extract')}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-white text-indigo-600 rounded-xl font-semibold hover:bg-indigo-50 transition-colors"
          >
            I'm logged in - Next step
          </button>
        </div>
      )}

      {step === 'extract' && (
        <div className="space-y-4">
          <div className="bg-white/10 rounded-xl p-4">
            <h4 className="font-semibold mb-2 flex items-center gap-2">
              <span className="bg-white text-indigo-600 rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">2</span>
              Extract your token
            </h4>
            <p className="text-indigo-100 text-sm mb-3">
              Choose one of these methods:
            </p>

            {/* Method A: Bookmarklet */}
            <div className="bg-white/10 rounded-lg p-3 mb-3">
              <p className="text-sm font-medium mb-2">Option A: Bookmarklet (Easy)</p>
              <p className="text-xs text-indigo-200 mb-2">
                Drag this button to your bookmarks bar, then click it on the Ethos page:
              </p>
              <div className="flex gap-2">
                <a
                  href={bookmarkletCode}
                  onClick={(e) => e.preventDefault()}
                  className="px-3 py-1.5 bg-amber-400 text-amber-900 rounded-lg text-sm font-medium cursor-move"
                  draggable
                >
                  📋 Get Ethos Token
                </a>
                <button
                  onClick={handleCopyBookmarklet}
                  className="px-3 py-1.5 bg-white/20 rounded-lg text-sm flex items-center gap-1"
                >
                  {copied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copied!' : 'Copy code'}
                </button>
              </div>
            </div>

            {/* Method B: Manual */}
            <div className="bg-white/10 rounded-lg p-3">
              <p className="text-sm font-medium mb-2">Option B: Manual (DevTools)</p>
              <ol className="text-xs text-indigo-200 space-y-1 list-decimal list-inside">
                <li>On Ethos page, press <kbd className="bg-white/20 px-1 rounded">F12</kbd></li>
                <li>Go to <strong>Application</strong> → <strong>Cookies</strong></li>
                <li>Find <code className="bg-white/20 px-1 rounded">privy-token</code></li>
                <li>Copy the value</li>
              </ol>
            </div>
          </div>

          <button
            onClick={() => setStep('paste')}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-white text-indigo-600 rounded-xl font-semibold hover:bg-indigo-50 transition-colors"
          >
            I have my token - Next step
          </button>
        </div>
      )}

      {step === 'paste' && (
        <div className="space-y-4">
          <div className="bg-white/10 rounded-xl p-4">
            <h4 className="font-semibold mb-2 flex items-center gap-2">
              <span className="bg-white text-indigo-600 rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">3</span>
              Paste your token
            </h4>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Paste your privy-token here..."
              className="w-full px-4 py-3 rounded-xl bg-white/20 border border-white/30 text-white placeholder-indigo-200 focus:outline-none focus:ring-2 focus:ring-white/50"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep('extract')}
              className="flex-1 px-6 py-3 bg-white/20 rounded-xl font-semibold hover:bg-white/30 transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleSubmitToken}
              disabled={!token.trim() || loading}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-white text-indigo-600 rounded-xl font-semibold hover:bg-indigo-50 transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Key className="w-5 h-5" />}
              Connect
            </button>
          </div>
        </div>
      )}

      <div className="mt-4 flex items-start gap-2 text-indigo-200 text-xs">
        <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <p>
          Your token is stored securely and used only to post positive reviews in defense of your relations.
          Tokens expire after ~24 hours.
        </p>
      </div>
    </div>
  );
}
