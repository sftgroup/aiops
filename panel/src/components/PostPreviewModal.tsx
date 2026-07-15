import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth, api } from '../AuthContext';
import toast from 'react-hot-toast';
import { X, Send, Loader2, Edit2, Eye, Heart, Repeat2, MessageCircle } from 'lucide-react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import type { Account, PublishResult } from '../types';

interface Props {
  text: string;
  imageUrl?: string;
  prompt: string;
  onClose: () => void;
  onSaved?: (newText: string) => void;
}

const PLATFORM_ICONS: Record<string, string> = {
  twitter: '🐦', youtube: '▶️', tiktok: '🎵', meta: '📱',
  bilibili: '📺', douyin: '🎬',
};

function formatTimestamp() {
  const now = new Date();
  return now.toLocaleString('zh-CN', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function extractHashtags(text: string): string[] {
  return (text.match(/#[\w\u4e00-\u9fff]+/g) || []).slice(0, 5);
}

export default function PostPreviewModal({ text, imageUrl, prompt, onClose, onSaved }: Props) {
  const { t } = useTranslation(['content', 'common']);
  const { token } = useAuth();
  const [editText, setEditText] = useState(text);
  const [mode, setMode] = useState<'edit' | 'preview'>('preview');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [animIn, setAnimIn] = useState(false);
  const containerRef = useFocusTrap(true);

  useEffect(() => {
    if (!token) return;
    api(token).get('/accounts').then(a => setAccounts(a)).catch(() => {});
  }, [token]);

  // Sync external text changes
  useEffect(() => { setEditText(text); }, [text]);

  // Enter animation
  useEffect(() => {
    requestAnimationFrame(() => requestAnimationFrame(() => setAnimIn(true)));
  }, []);

  const toggleAccount = (id: string) => {
    setSelectedAccounts(prev =>
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    );
  };

  const handleSaveDraft = async () => {
    if (!token) return;
    try {
      const body: Record<string, unknown> = { title: prompt, text: editText };
      if (imageUrl) body.imageUrl = imageUrl;
      await api(token).post('/contents/text', body);
      toast.success(t('common:toast.saved'));
      onSaved?.(editText);
      onClose();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(msg || t('common:error.generic'));
    }
  };

  const handlePublish = async () => {
    if (!editText) return toast.error(t('modal.publishEmpty'));
    if (selectedAccounts.length === 0) return toast.error(t('modal.selectAccountRequired'));
    setPublishing(true);
    try {
      const results = await api(token!).post('/publish', {
        text: editText,
        accountIds: selectedAccounts,
      });
      const ok = results.filter((r: PublishResult) => r.status === 'published').length;
      const fail = results.filter((r: PublishResult) => r.status === 'failed').length;
      if (ok > 0) toast.success(t('modal.publishSuccess', { count: ok }));
      if (fail > 0) toast.error(t('modal.publishFailed', { count: fail }));
      // 保存到历史
      const body2: Record<string, unknown> = { title: prompt, text: editText };
      if (imageUrl) body2.imageUrl = imageUrl;
      await api(token!).post('/contents/text', body2).catch(() => {});
      onSaved?.(editText);
      onClose();
    } catch (e: unknown) {
      toast.error((e instanceof Error ? e.message : String(e)) || t('modal.publishError'));
    } finally {
      setPublishing(false);
    }
  };

  const groups = accounts.reduce<Record<string, Account[]>>((g, a) => {
    (g[a.platform] = g[a.platform] || []).push(a);
    return g;
  }, {});

  return (
    <div ref={containerRef}>
      {/* Overlay */}
      <div
        className={`fixed inset-0 z-50 transition-opacity duration-200 ${
          animIn ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
      >
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      </div>

      {/* Desktop: centered modal (≥640px) */}
      <div
        className={`hidden sm:flex fixed inset-0 z-50 items-center justify-center transition-all duration-200 ${
          animIn ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
        }`}
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-label={t('modal.dialogLabel')}
      >
        <div
          className="bg-dark-card border border-dark-border rounded-2xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col shadow-2xl"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-dark-border shrink-0">
            <div className="flex items-center gap-3">
              <h3 className="font-semibold text-white">{t('modal.title')}</h3>
              <div className="flex bg-dark-bg rounded-xl p-0.5 border border-dark-border">
                <button
                  onClick={() => setMode('preview')}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    mode === 'preview'
                      ? 'bg-accent-primary text-white shadow-sm'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <Eye size={13} /> {t('modal.previewTab')}
                </button>
                <button
                  onClick={() => setMode('edit')}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    mode === 'edit'
                      ? 'bg-accent-primary text-white shadow-sm'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <Edit2 size={13} /> {t('modal.editTab')}
                </button>
              </div>
            </div>
            <button onClick={onClose} className="p-2 text-gray-500 hover:text-white rounded-lg hover:bg-dark-hover transition-colors" style={{ minWidth: 44, minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} aria-label={t('common:button.close')}>
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {mode === 'edit' ? (
              <div>
                <label className="text-xs text-gray-500 block mb-1.5">{t('modal.editLabel')}</label>
                <textarea
                  className="w-full px-3 py-2.5 bg-dark-bg border border-dark-border rounded-lg text-white focus:outline-none focus:border-accent-primary h-48 resize-none text-sm leading-relaxed"
                  value={editText}
                  onChange={e => setEditText(e.target.value)}
                />
                <div className="flex justify-between mt-1">
                  <span className="text-xs text-gray-600">{t('modal.editHint')}</span>
                  <span className={`text-xs ${editText.length > 280 ? 'text-red-400' : 'text-gray-500'}`}>
                    {t('modal.charCount', { count: editText.length })}
                  </span>
                </div>
              </div>
            ) : (
              <div className="bg-black rounded-xl border border-gray-800 overflow-hidden">
                <div className="px-4 pt-3 pb-1 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent-primary to-purple-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                    AI
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-bold text-white truncate">{t('result.authorName')}</span>
                      <svg viewBox="0 0 22 22" className="w-5 h-5 text-blue-400 shrink-0" fill="currentColor">
                        <path d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.1-.47.156-.958.156-1.462 0-2.41-1.648-4.443-3.934-5.04-.443-.117-.906-.182-1.382-.182-.414 0-.826.045-1.23.13C10.728 1.5 9.168 2.494 8.1 3.916c-.522.668-.928 1.456-1.158 2.338-.264-.09-.544-.138-.828-.138-.89 0-1.727.353-2.325.934-.598.58-.95 1.385-.95 2.248 0 .338.06.668.16.984-1.476.726-2.59 2.07-2.88 3.697-.396 2.21.796 4.416 2.9 5.386.285.131.59.223.906.287.303.793.83 1.54 1.57 2.09.736.55 1.614.86 2.54.86h8.25c.926 0 1.804-.31 2.54-.86.74-.55 1.267-1.297 1.57-2.09.316-.064.62-.156.905-.287 2.104-.97 3.296-3.177 2.9-5.386z"/>
                      </svg>
                    </div>
                    <span className="text-xs text-gray-500">{t('result.authorHandle')} · {formatTimestamp()}</span>
                  </div>
                  <svg viewBox="0 0 24 24" className="w-5 h-5 text-blue-400 shrink-0" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                </div>
                <div className="px-4 py-2">
                  <p className="text-[15px] leading-relaxed text-white whitespace-pre-wrap">{editText}</p>
                </div>
                {extractHashtags(editText).length > 0 && (
                  <div className="px-4 pb-1 flex flex-wrap gap-1.5">
                    {extractHashtags(editText).map((tag, i) => (
                      <span key={i} className="text-sm text-blue-400 hover:underline cursor-pointer">{tag}</span>
                    ))}
                  </div>
                )}
                {imageUrl && (
                  <div className="mx-4 mb-2 rounded-xl overflow-hidden border border-gray-800">
                    <img src={imageUrl} alt={t('modal.previewImageAlt')} className="w-full object-contain" style={{ maxHeight: 288 }} />
                  </div>
                )}
                <div className="px-4 py-1.5 flex items-center justify-between max-w-md">
                  <div className="flex items-center gap-1 text-gray-500">
                    <MessageCircle size={16} />
                    <span className="text-xs">12</span>
                  </div>
                  <div className="flex items-center gap-1 text-gray-500">
                    <Repeat2 size={16} />
                    <span className="text-xs">5</span>
                  </div>
                  <div className="flex items-center gap-1 text-gray-500">
                    <Heart size={16} />
                    <span className="text-xs">28</span>
                  </div>
                  <div className="flex items-center gap-1 text-gray-500">
                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.5 14h-9c-.828 0-1.5-.672-1.5-1.5S6.672 13 7.5 13h9c.828 0 1.5.672 1.5 1.5s-.672 1.5-1.5 1.5zm0-5h-9c-.828 0-1.5-.672-1.5-1.5S6.672 8 7.5 8h9c.828 0 1.5.672 1.5 1.5s-.672 1.5-1.5 1.5z"/>
                    </svg>
                    <span className="text-xs">{t('modal.share')}</span>
                  </div>
                </div>
              </div>
            )}

            {/* 发布账号选择 */}
            <div className="space-y-2 pt-2 border-t border-dark-border">
              <h4 className="text-xs text-gray-400 font-medium flex items-center gap-1">
                <Send size={12} /> {t('modal.selectAccount')}
              </h4>
              {Object.keys(groups).length === 0 ? (
                <p className="text-xs text-gray-600">{t('modal.noAccounts')}</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(groups).flatMap(([platform, accs]) =>
                    accs.map(acc => (
                      <button
                        key={acc.id}
                        onClick={() => toggleAccount(acc.id)}
                        className={`inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs border transition-colors ${
                          selectedAccounts.includes(acc.id)
                            ? 'bg-accent-primary/20 border-accent-primary text-accent-primary'
                            : 'bg-dark-bg border-dark-border text-gray-400 hover:border-gray-500'
                        }`}
                        style={{ minHeight: 44 }}
                      >
                        {PLATFORM_ICONS[acc.platform] || '🔗'}
                        @{acc.screenName || acc.name}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-5 py-4 border-t border-dark-border gap-3 shrink-0">
            <button
              onClick={handleSaveDraft}
              className="flex items-center gap-1.5 px-4 py-2.5 text-xs text-gray-400 border border-dark-border rounded-xl hover:text-white hover:border-gray-500 transition-all hover:bg-dark-hover"
            >
              💾 {t('modal.saveDraft')}
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2.5 text-xs text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-dark-hover"
              >
                {t('common:button.close')}
              </button>
              {selectedAccounts.length > 0 && (
                <span className="text-xs text-gray-600">
                  {t('modal.selectedAccounts', { count: selectedAccounts.length })}
                </span>
              )}
              <button
                onClick={handlePublish}
                disabled={publishing || !editText || selectedAccounts.length === 0}
                className="flex items-center gap-1.5 px-5 py-2.5 bg-accent-primary hover:bg-accent-primary/80 rounded-xl text-xs font-medium transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                style={{ minHeight: 44 }}
              >
                {publishing ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                {publishing ? t('modal.publishing') : t('modal.publish')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile (<640px): bottom sheet */}
      <div
        className={`sm:hidden fixed inset-0 z-50 flex flex-col justify-end transition-all duration-200`}
      >
        <div
          className={`absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-200 ${
            animIn ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={onClose}
        />
        <div
          className={`relative bg-dark-card border border-dark-border rounded-t-2xl flex flex-col animate-slide-up safe-bottom transition-all duration-200 ${
            animIn ? 'translate-y-0' : 'translate-y-full'
          }`}
          onClick={e => e.stopPropagation()}
          style={{ maxHeight: '85vh' }}
        >
          <div className="w-10 h-1 bg-gray-600 rounded-full mx-auto mt-3 mb-1" />

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-dark-border shrink-0">
            <h3 className="font-semibold text-white text-sm">{t('modal.title')}</h3>
            <div className="flex items-center gap-2">
              <div className="flex bg-dark-bg rounded-xl p-0.5 border border-dark-border">
                <button
                  onClick={() => setMode('preview')}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    mode === 'preview'
                      ? 'bg-accent-primary text-white shadow-sm'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <Eye size={12} /> {t('modal.previewTab')}
                </button>
                <button
                  onClick={() => setMode('edit')}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    mode === 'edit'
                      ? 'bg-accent-primary text-white shadow-sm'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <Edit2 size={12} /> {t('modal.editTab')}
                </button>
              </div>
              <button onClick={onClose} className="p-2 text-gray-500 hover:text-white rounded-lg hover:bg-dark-hover transition-colors" style={{ minWidth: 44, minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
            {mode === 'edit' ? (
              <div>
                <label className="text-xs text-gray-500 block mb-1.5">{t('modal.editLabel')}</label>
                <textarea
                  className="w-full px-3 py-2.5 bg-dark-bg border border-dark-border rounded-lg text-white focus:outline-none focus:border-accent-primary h-48 resize-none text-sm leading-relaxed"
                  value={editText}
                  onChange={e => setEditText(e.target.value)}
                />
                <div className="flex justify-between mt-1">
                  <span className="text-xs text-gray-600">{t('modal.editHint')}</span>
                  <span className={`text-xs ${editText.length > 280 ? 'text-red-400' : 'text-gray-500'}`}>
                    {t('modal.charCount', { count: editText.length })}
                  </span>
                </div>
              </div>
            ) : (
              <div className="bg-black rounded-xl border border-gray-800 overflow-hidden">
                <div className="px-4 pt-3 pb-1 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent-primary to-purple-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                    AI
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-bold text-white truncate">{t('result.authorName')}</span>
                      <svg viewBox="0 0 22 22" className="w-5 h-5 text-blue-400 shrink-0" fill="currentColor">
                        <path d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.1-.47.156-.958.156-1.462 0-2.41-1.648-4.443-3.934-5.04-.443-.117-.906-.182-1.382-.182-.414 0-.826.045-1.23.13C10.728 1.5 9.168 2.494 8.1 3.916c-.522.668-.928 1.456-1.158 2.338-.264-.09-.544-.138-.828-.138-.89 0-1.727.353-2.325.934-.598.58-.95 1.385-.95 2.248 0 .338.06.668.16.984-1.476.726-2.59 2.07-2.88 3.697-.396 2.21.796 4.416 2.5 5.386.285.131.59.223.906.287.303.793.83 1.54 1.57 2.09.736.55 1.614.86 2.54.86h8.25c.926 0 1.804-.31 2.54-.86.74-.55 1.267-1.297 1.57-2.09.316-.064.62-.156.905-.287 2.104-.97 3.296-3.177 2.9-5.386z"/>
                      </svg>
                    </div>
                    <span className="text-xs text-gray-500">{t('result.authorHandle')} · {formatTimestamp()}</span>
                  </div>
                  <svg viewBox="0 0 24 24" className="w-5 h-5 text-blue-400 shrink-0" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                </div>
                <div className="px-4 py-2">
                  <p className="text-[15px] leading-relaxed text-white whitespace-pre-wrap">{editText}</p>
                </div>
                {extractHashtags(editText).length > 0 && (
                  <div className="px-4 pb-1 flex flex-wrap gap-1.5">
                    {extractHashtags(editText).map((tag, i) => (
                      <span key={i} className="text-sm text-blue-400 hover:underline cursor-pointer">{tag}</span>
                    ))}
                  </div>
                )}
                {imageUrl && (
                  <div className="mx-4 mb-2 rounded-xl overflow-hidden border border-gray-800">
                    <img src={imageUrl} alt={t('modal.previewImageAlt')} className="w-full object-contain" style={{ maxHeight: 288 }} />
                  </div>
                )}
                <div className="px-4 py-1.5 flex items-center justify-between max-w-md">
                  <div className="flex items-center gap-1 text-gray-500">
                    <MessageCircle size={16} />
                    <span className="text-xs">12</span>
                  </div>
                  <div className="flex items-center gap-1 text-gray-500">
                    <Repeat2 size={16} />
                    <span className="text-xs">5</span>
                  </div>
                  <div className="flex items-center gap-1 text-gray-500">
                    <Heart size={16} />
                    <span className="text-xs">28</span>
                  </div>
                  <div className="flex items-center gap-1 text-gray-500">
                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.5 14h-9c-.828 0-1.5-.672-1.5-1.5S6.672 13 7.5 13h9c.828 0 1.5.672 1.5 1.5s-.672 1.5-1.5 1.5zm0-5h-9c-.828 0-1.5-.672-1.5-1.5S6.672 8 7.5 8h9c.828 0 1.5.672 1.5 1.5s-.672 1.5-1.5 1.5z"/>
                    </svg>
                    <span className="text-xs">{t('modal.share')}</span>
                  </div>
                </div>
              </div>
            )}

            {/* 发布账号选择 */}
            <div className="space-y-2 pt-2 border-t border-dark-border pb-2">
              <h4 className="text-xs text-gray-400 font-medium flex items-center gap-1">
                <Send size={12} /> {t('modal.selectAccount')}
              </h4>
              {Object.keys(groups).length === 0 ? (
                <p className="text-xs text-gray-600">{t('modal.noAccounts')}</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(groups).flatMap(([platform, accs]) =>
                    accs.map(acc => (
                      <button
                        key={acc.id}
                        onClick={() => toggleAccount(acc.id)}
                        className={`inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs border transition-colors ${
                          selectedAccounts.includes(acc.id)
                            ? 'bg-accent-primary/20 border-accent-primary text-accent-primary'
                            : 'bg-dark-bg border-dark-border text-gray-400 hover:border-gray-500'
                        }`}
                        style={{ minHeight: 44 }}
                      >
                        {PLATFORM_ICONS[acc.platform] || '🔗'}
                        @{acc.screenName || acc.name}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-dark-border gap-2 shrink-0 safe-bottom">
            <button
              onClick={handleSaveDraft}
              className="flex items-center gap-1.5 px-4 py-3 text-xs text-gray-400 border border-dark-border rounded-xl hover:text-white hover:border-gray-500 transition-all hover:bg-dark-hover"
              style={{ minHeight: 44 }}
            >
              💾 {t('modal.saveDraft')}
            </button>
            <div className="flex items-center gap-2">
              {selectedAccounts.length > 0 && (
                <span className="text-xs text-gray-600">
                  {t('modal.selectedAccounts', { count: selectedAccounts.length })}
                </span>
              )}
              <button
                onClick={handlePublish}
                disabled={publishing || !editText || selectedAccounts.length === 0}
                className="flex items-center gap-1.5 px-5 py-3 bg-accent-primary hover:bg-accent-primary/80 rounded-xl text-xs font-medium transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                style={{ minHeight: 44 }}
              >
                {publishing ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                {publishing ? t('modal.publishing') : t('modal.publish')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
