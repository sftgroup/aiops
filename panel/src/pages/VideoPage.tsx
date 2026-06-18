import React, { useState } from 'react';
import { useAuth, api } from '../AuthContext';
import toast from 'react-hot-toast';
import { Loader2, Play } from 'lucide-react';

export default function VideoPage() {
  const { token } = useAuth();
  const [subject, setSubject] = useState('');
  const [script, setScript] = useState('');
  const [aspect, setAspect] = useState('9:16');
  const [loading, setLoading] = useState(false);
  const [generatingScript, setGeneratingScript] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [taskStatus, setTaskStatus] = useState<string>('');

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
    setLoading(true);
    setTaskStatus('提交任务...');
    try {
      const d = await api(token!).post('/videos/generate', { subject, script, aspect });
      setTaskId(d.taskId);

      // Poll for completion
      const poll = async () => {
        try {
          const r = await api(token!).get(`/videos/tasks/${d.taskId}`);
          if (r.data?.state === 2) {
            setTaskStatus('✅ 视频生成完成');
            toast.success('视频生成完成');
          } else if (r.data?.state === 3) {
            setTaskStatus('❌ 生成失败');
            toast.error('视频生成失败');
          } else {
            setTaskStatus(`生成中... (${r.data?.progress || 0}%)`);
            setTimeout(poll, 3000);
          }
        } catch { setTaskStatus('轮询失败，可稍后查看'); }
      };
      poll();
    } catch (e: any) { toast.error(e.message); setLoading(false); }
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

          <div>
            <label className="block text-sm text-gray-400 mb-1">视频比例</label>
            <select
              className="w-full px-3 py-2.5 bg-dark-card border border-dark-border rounded-lg text-white focus:outline-none focus:border-accent-primary"
              value={aspect}
              onChange={e => setAspect(e.target.value)}
            >
              <option value="9:16">竖屏 9:16 (抖音/TikTok/Reels)</option>
              <option value="16:9">横屏 16:9 (YouTube/B站)</option>
              <option value="1:1">方形 1:1</option>
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm text-gray-400">视频文案</label>
              <button
                onClick={handleGenerateScript}
                disabled={generatingScript || !subject}
                className="text-xs text-accent-primary hover:underline disabled:opacity-50"
              >
                {generatingScript ? '生成中...' : 'AI 生成文案'}
              </button>
            </div>
            <textarea
              className="w-full px-3 py-2.5 bg-dark-card border border-dark-border rounded-lg text-white focus:outline-none focus:border-accent-primary h-40 resize-none"
              value={script}
              onChange={e => setScript(e.target.value)}
              placeholder="AI 自动生成或手动输入文案..."
            />
          </div>

          <button
            onClick={handleCreateVideo}
            disabled={loading || !subject}
            className="flex items-center justify-center gap-2 w-full py-3 bg-accent-primary hover:bg-accent-primary/80 rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />}
            {loading ? '任务提交中...' : '生成视频'}
          </button>

          {taskStatus && (
            <div className="bg-dark-card rounded-lg p-3 border border-dark-border text-sm">
              <p className="text-gray-400">任务状态：</p>
              <p className="text-accent-primary mt-1">{taskStatus}</p>
              {taskId && <p className="text-xs text-gray-600 mt-1">Task ID: {taskId}</p>}
            </div>
          )}
        </div>

        <div className="bg-dark-card rounded-xl p-5 border border-dark-border">
          <h3 className="font-semibold mb-3">MPTurbo 状态</h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-accent-success"></div>
              <span className="text-gray-400">DeepSeek LLM</span>
              <span className="ml-auto text-gray-500">已配置</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-accent-warning"></div>
              <span className="text-gray-400">Pexels 素材</span>
              <span className="ml-auto text-gray-500">需配置 API Key</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-accent-success"></div>
              <span className="text-gray-400">Edge TTS</span>
              <span className="ml-auto text-gray-500">免费可用</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-accent-success"></div>
              <span className="text-gray-400">字幕生成</span>
              <span className="ml-auto text-gray-500">Edge 模式(无需GPU)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
