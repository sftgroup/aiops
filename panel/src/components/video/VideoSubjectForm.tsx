import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Timer, Upload, Image, X } from 'lucide-react';
import { useAuth, api } from '../../AuthContext';
import toast from 'react-hot-toast';

interface VideoSubjectFormProps {
  subject: string;
  setSubject: (v: string) => void;
  duration: number;
  setDuration: (v: number) => void;
  customDuration: string;
  setCustomDuration: (v: string) => void;
  showCustomDuration: boolean;
  setShowCustomDuration: (v: boolean) => void;
  generating: boolean;
}

export default function VideoSubjectForm({
  subject, setSubject,
  duration, setDuration,
  customDuration, setCustomDuration,
  showCustomDuration, setShowCustomDuration,
  generating
}: VideoSubjectFormProps) {
  const { t } = useTranslation(['video', 'common']);
  const { token } = useAuth();
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Load logo from settings on mount
  useEffect(() => {
    if (!token) return;
    api(token).get('/settings').then(r => {
      setLogoUrl(r.video_logo_url || '');
    }).catch(() => setLogoUrl(''));
  }, [token]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const resp = await fetch('/api/settings/upload', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: form,
      });
      const data = await resp.json();
      if (data.url) {
        setLogoUrl(data.url);
        toast.success('Logo 上传成功');
      } else {
        throw new Error(data.error || '上传失败');
      }
    } catch (e: any) {
      toast.error(e.message || '上传失败');
    } finally {
      setUploading(false);
    }
  };

  const clearLogo = async () => {
    try {
      await api(token!).post('/settings', { video_logo_url: '' });
      setLogoUrl('');
      toast.success('Logo 已移除');
    } catch (e: any) {
      toast.error(e.message || '移除失败');
    }
  };

  return (
    <div className="bg-dark-card rounded-xl border border-dark-border overflow-hidden" role="region" aria-label={t('subjectForm.ariaLabel')}>
      <div className="px-5 py-4 border-b border-dark-border flex items-center gap-2">
        <span className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center shrink-0" aria-hidden="true">
          <span className="text-xs">🎯</span>
        </span>
        <h3 className="font-semibold sm:text-base text-sm">{t('subjectForm.heading')}</h3>
      </div>
      <div className="p-4 sm:p-5 space-y-5">
        <input
          className="w-full px-4 py-3 bg-dark-bg border border-dark-border rounded-xl text-white focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 transition-all text-base"
          value={subject}
          onChange={e => setSubject(e.target.value)}
          placeholder={t('subjectForm.placeholder')}
          disabled={generating}
          aria-label={t('subjectForm.heading')}
        />

        {/* Duration Selector */}
        <div role="radiogroup" aria-label={t('subjectForm.durationLabel')}>
          <label className="flex items-center gap-1.5 text-xs sm:text-sm text-gray-400 mb-3">
            <Timer size={16} />
            {t('subjectForm.durationLabel')}
          </label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={4}
              max={12}
              step={1}
              value={duration}
              onChange={e => setDuration(Number(e.target.value))}
              disabled={generating}
              className="flex-1 h-2 bg-dark-bg rounded-lg appearance-none cursor-pointer accent-purple-500 disabled:opacity-50"
              aria-label={t('subjectForm.durationLabel')}
            />
            <span className="w-16 text-center px-3 py-1.5 bg-purple-500/20 border border-purple-500/30 rounded-lg text-sm font-semibold text-purple-300">
              {duration}s
            </span>
          </div>
        </div>

        {/* Logo Watermark Upload */}
        <div>
          <label className="flex items-center gap-1.5 text-xs sm:text-sm text-gray-400 mb-3">
            <Image size={16} />
            视频水印 Logo
          </label>
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <div className="relative">
                <img src={logoUrl} alt="Logo" className="w-12 h-12 object-contain rounded-lg bg-dark-bg border border-dark-border p-1" />
                <button
                  onClick={clearLogo}
                  className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-xs hover:bg-red-600"
                ><X size={10} /></button>
              </div>
            ) : (
              <div className="w-12 h-12 rounded-lg bg-dark-bg border border-dark-border flex items-center justify-center text-gray-600">
                <Image size={20} />
              </div>
            )}
            <label className="flex items-center gap-1.5 px-3 py-2 bg-dark-border rounded-lg cursor-pointer hover:bg-gray-600 text-xs text-gray-300">
              <Upload size={14} />
              {uploading ? '上传中...' : '上传 Logo'}
              <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={uploading} />
            </label>
          </div>
          <p className="text-[10px] text-gray-600 mt-2">💡 透明 PNG 最佳。将叠加在视频右上角。</p>
        </div>

      </div>
    </div>
  );
}