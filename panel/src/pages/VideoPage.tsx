import React, { useState } from 'react';
import { useAuth, api } from '../AuthContext';
import toast from 'react-hot-toast';
import { Loader2, Sparkles, Settings } from 'lucide-react';

export default function VideoPage() {
  const { token } = useAuth();
  const [subject, setSubject] = useState('');
  const [script, setScript] = useState('');
  const [aspect, setAspect] = useState('9:16');
  const [duration, setDuration] = useState(15);
  const [resolution, setResolution] = useState('720p');
  const [generatingScript, setGeneratingScript] = useState(false);
  const [generating, setGenerating] = useState(false);

  const handleGenerateScript = async () => {
    if (!subject) return toast.error('请输入视频主题');
    setGeneratingScript(true);
    try {
      const d = await api(token!).post('/videos/scripts', { subject });
      setScript(d.script);
      toast.success('文案生成成功');
    } catch (e: any) { toast.error(e.message); }
    finally { setGeneratingScript(false); }
  };

  const handleCreateVideo = async () => {
    if (!subject) return toast.error('请输入视频主题');
    setGenerating(true);
    try {
      const d = await api(token!).post('/videos/generate', {
        subject, script,
        aspect,
        duration: Math.min(duration, 15),
        resolution,
        source: 'seedance'
      });
      toast.success('视频生成任务已提交！');
      // TODO: poll for Seedance task completion
    } catch (e: any) { toast.error(e.message); }
    finally { setGenerating(false); }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">🎬 视频制作</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">视频主题</label>
            <input
              className="w-full px-3 py-2.5 bg-dark-card border border-dark-border rounded-lg text-white focus:outline-none focus:border-accent-primary"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="例如：AI 改变生活"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">视频比例</label>
              <select
                className="w-full px-3 py-2.5 bg-dark-card border border-dark-border rounded-lg text-white focus:outline-none"
                value={aspect}
                onChange={e => setAspect(e.target.value)}
              >
                <option value="9:16">竖屏 9:16</option>
                <option value="16:9">横屏 16:9</option>
                <option value="1:1">方形 1:1</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">时长（秒）</label>
              <select
                className="w-full px-3 py-2.5 bg-dark-card border border-dark-border rounded-lg text-white focus:outline-none"
                value={duration}
                onChange={e => setDuration(Number(e.target.value))}
              >
                <option value={5}>5 秒</option>
                <option value={10}>10 秒</option>
                <option value={15}>15 秒</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">分辨率</label>
              <select
                className="w-full px-3 py-2.5 bg-dark-card border border-dark-border rounded-lg text-white focus:outline-none"
                value={resolution}
                onChange={e => setResolution(e.target.value)}
              >
                <option value="480p">480p</option>
                <option value="720p">720p</option>
                <option value="1080p">1080p</option>
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm text-gray-400">视频文案 / 提示词</label>
              <button
                onClick={handleGenerateScript}
                disabled={generatingScript || !subject}
                className="text-xs text-accent-primary hover:underline disabled:opacity-50 flex items-center gap-1"
              >
                {generatingScript ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                {generatingScript ? '生成中...' : 'AI 生成文案'}
              </button>
            </div>
            <textarea
              className="w-full px-3 py-2.5 bg-dark-card border border-dark-border rounded-lg text-white focus:outline-none focus:border-accent-primary h-40 resize-none"
              value={script}
              onChange={e => setScript(e.target.value)}
              placeholder="AI 自动生成或手动输入提示词。Seedance 会自动根据文字生成匹配画面..."
            />
          </div>

          <button
            onClick={handleCreateVideo}
            disabled={generating || !subject}
            className="flex items-center justify-center gap-2 w-full py-3 bg-accent-primary hover:bg-accent-primary/80 rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {generating ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
            {generating ? '提交中...' : 'AI 生成视频'}
          </button>
        </div>

        {/* Side panel: Seedance info */}
        <div className="bg-dark-card rounded-xl p-5 border border-dark-border">
          <h3 className="font-semibold mb-3 flex items-center gap-2"><Sparkles size={16} /> Seedance 2.0 AI 视频</h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-accent-success"></div>
              <span className="text-gray-400">DeepSeek 文案</span>
              <span className="ml-auto text-gray-500">已配置</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-yellow-400"></div>
              <span className="text-gray-400">火山引擎 API Key</span>
              <span className="ml-auto text-gray-500">待填写</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-yellow-400"></div>
              <span className="text-gray-400">Seedance 模型</span>
              <span className="ml-auto text-gray-500">待配置</span>
            </div>
          </div>

          <hr className="border-dark-border my-4" />

          <p className="text-xs text-gray-500 leading-relaxed">
            Seedance 2.0 是火山引擎的 AI 视频生成模型，支持文字直接生成 15 秒视频片段，自带配音。相比旧的 MPTurbo 方案，<strong className="text-gray-300">无需下载任何素材</strong>。
          </p>
          <p className="text-xs text-gray-600 mt-2">
            📌 请先到 <a href="#/settings" className="text-blue-400 hover:underline">系统配置</a> 页面填写火山引擎 API Key 和模型 ID。
          </p>
        </div>
      </div>
    </div>
  );
}
