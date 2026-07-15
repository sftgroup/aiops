import { useState, useEffect } from 'react';
import { Save, Settings } from 'lucide-react';
import { adminGet, adminPut } from '../../lib/admin-api';

interface SystemSettings {
  registrationOpen?: boolean;
  announcement?: string;
  rates?: {
    ai_per_call?: number;
    tts_per_char?: number;
  };
}

export default function OperatorSettings() {
  const [_settings, _setSettings]   = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [registrationOpen, setRegistrationOpen] = useState(true);
  const [announcement, setAnnouncement] = useState('');
  const [aiRate, setAiRate] = useState('0.01');
  const [ttsRate, setTtsRate] = useState('0.005');

  const loadSettings = async () => {
    setLoading(true);
    try {
      const data = await adminGet('/settings');
      _setSettings(data);
      setRegistrationOpen(data.registrationOpen ?? true);
      setAnnouncement(data.announcement || '');
      setAiRate(String(data.rates?.ai_per_call ?? 0.01));
      setTtsRate(String(data.rates?.tts_per_char ?? 0.005));
    } catch (e) {
      console.error(e);
      // If backend isn't implemented, use defaults
      _setSettings({ registrationOpen: true, announcement: '', rates: { ai_per_call: 0.01, tts_per_char: 0.005 } });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await adminPut('/settings', {
        registrationOpen,
        announcement,
        rates: {
          ai_per_call: parseFloat(aiRate) || 0.01,
          tts_per_char: parseFloat(ttsRate) || 0.005,
        },
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-[#6366f1] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold">System Settings</h2>
        <p className="text-sm text-gray-500 mt-1">Configure platform-wide settings</p>
      </div>

      <div className="space-y-6">
        {/* General Settings */}
        <div className="bg-[#1a1a2e] rounded-xl border border-[#2a2a3e] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#2a2a3e] flex items-center gap-2">
            <Settings className="w-4 h-4 text-[#6366f1]" />
            <h3 className="font-semibold text-white">General</h3>
          </div>
          <div className="p-5 space-y-4">
            {/* Registration Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white font-medium">Open Registration</p>
                <p className="text-xs text-gray-500">Allow new users to sign up</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={registrationOpen}
                  onChange={(e) => setRegistrationOpen(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-[#0f0f1a] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#6366f1] border border-[#2a2a3e]" />
              </label>
            </div>

            {/* Announcement */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1.5">
                Platform Announcement
              </label>
              <textarea
                value={announcement}
                onChange={(e) => setAnnouncement(e.target.value)}
                placeholder="Announcement shown on user dashboard..."
                className="w-full px-4 py-3 bg-[#0f0f1a] border border-[#2a2a3e] rounded-xl text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-[#6366f1]/50 transition-all resize-none h-20"
              />
            </div>
          </div>
        </div>

        {/* Rate Limits */}
        <div className="bg-[#1a1a2e] rounded-xl border border-[#2a2a3e] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#2a2a3e] flex items-center gap-2">
            <span className="text-[#6366f1] text-sm">$</span>
            <h3 className="font-semibold text-white">Rate Limits & Pricing</h3>
          </div>
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">
                  AI Call Rate ($/call)
                </label>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={aiRate}
                  onChange={(e) => setAiRate(e.target.value)}
                  className="w-full px-4 py-3 bg-[#0f0f1a] border border-[#2a2a3e] rounded-xl text-white text-sm focus:outline-none focus:border-[#6366f1]/50 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">
                  TTS Rate ($/char)
                </label>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={ttsRate}
                  onChange={(e) => setTtsRate(e.target.value)}
                  className="w-full px-4 py-3 bg-[#0f0f1a] border border-[#2a2a3e] rounded-xl text-white text-sm focus:outline-none focus:border-[#6366f1]/50 transition-all"
                />
              </div>
            </div>
            <p className="text-[10px] text-gray-600">
              Note: Rate changes will apply to new usage only.
            </p>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 bg-[#6366f1] hover:bg-[#5558e6] rounded-xl text-sm font-medium text-white transition-all disabled:opacity-50 active:scale-95"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
          {saved && (
            <span className="text-sm text-green-400 animate-pulse">Settings saved!</span>
          )}
        </div>

        {/* Placeholder for non-implemented settings */}
        <div className="bg-[#1a1a2e] rounded-xl border border-[#2a2a3e] p-8">
          <div className="text-center">
            <Settings className="w-8 h-8 text-gray-600 mx-auto mb-2" />
            <p className="text-sm text-gray-500">More settings coming soon</p>
            <p className="text-xs text-gray-600 mt-1">
              SMTP, OAuth, Webhook, and notification settings will be available in future releases.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
