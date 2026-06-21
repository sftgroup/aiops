import React from 'react';
import { CheckCircle2, XCircle, Loader2, Send, Globe, ThumbsUp, ThumbsDown } from 'lucide-react';

interface ArticleItem {
  id: string; title: string; body: string; imageUrl: string;
  platformVariants: Record<string, string>;
  review: { status: 'pending' | 'pass' | 'reject'; reason: string };
  publishedTo: string[]; createdAt: string;
}

interface VideoItem {
  id: string; subject: string; script: string; videoUrl: string;
  platformVariants: Record<string, string>;
  review: { status: 'pending' | 'pass' | 'reject'; reason: string };
  publishedTo: string[]; createdAt: string;
}

interface ReviewPanelProps {
  articles: ArticleItem[];
  videos: VideoItem[];
  onReviewBatch: (action: 'approve' | 'reject') => void;
  onReviewItem: (type: 'article' | 'video', id: string, action: 'approve' | 'reject') => void;
  pendingArticles: ArticleItem[];
  passedArticles: ArticleItem[];
  pendingVideos: VideoItem[];
  passedVideos: VideoItem[];
  onPublishAll: () => void;
  publishing: boolean;
  intervalMinutes: number;
}

export default function ReviewPanel({
  articles, videos,
  onReviewBatch, onReviewItem,
  pendingArticles, passedArticles,
  pendingVideos, passedVideos,
  onPublishAll, publishing, intervalMinutes,
}: ReviewPanelProps) {

  return (
    <div className="space-y-6">
      {/* Articles */}
      <div>
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <span>📄</span> 图文内容
          <span className="text-xs text-gray-500 font-normal">({articles.length}篇)</span>
          {pendingArticles.length > 0 && <span className="text-xs text-yellow-400 font-normal">待审{pendingArticles.length}</span>}
          {passedArticles.length > 0 && <span className="text-xs text-green-400 font-normal">已过{passedArticles.length}</span>}
        </h3>
        <div className="grid gap-3">
          {articles.map(art => (
            <div key={art.id} className="bg-dark-card rounded-xl p-4 border border-dark-border">
              <div className="flex items-start gap-4">
                {art.imageUrl && (
                  <img src={art.imageUrl} alt="" className="w-20 h-20 rounded-lg object-cover shrink-0 bg-dark-bg" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium truncate">{art.title}</h4>
                    {art.review.status === 'pass' && <CheckCircle2 size={14} className="text-green-400 shrink-0" />}
                    {art.review.status === 'reject' && <XCircle size={14} className="text-red-400 shrink-0" />}
                    {art.review.status === 'pending' && <Loader2 size={14} className="animate-spin text-yellow-400 shrink-0" />}
                    {art.publishedTo.length > 0 && <Send size={14} className="text-blue-400 shrink-0" />}
                  </div>
                  <p className="text-sm text-gray-400 line-clamp-2">{art.body}</p>

                  {/* Platform variants + Published accounts */}
                  {Object.keys(art.platformVariants).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {Object.entries(art.platformVariants).map(([p, t]) => (
                        <span key={p} title={t} className="text-xs px-2 py-0.5 rounded bg-dark-bg text-gray-500 flex items-center gap-1 max-w-[200px] truncate">
                          <Globe size={10} /> {p}: {t.slice(0, 40)}...
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Published to */}
                  {art.publishedTo.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      <span className="text-[10px] text-blue-400">已发布:</span>
                      {art.publishedTo.map((s: string, i: number) => (
                        <span key={i} className="text-[10px] px-1.5 py-0.5 bg-blue-500/10 text-blue-400 rounded">{s}</span>
                      ))}
                    </div>
                  )}

                  {/* Review controls */}
                  {art.review.status === 'pending' && (
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => onReviewItem('article', art.id, 'approve')}
                        className="flex items-center gap-1 px-3 py-1.5 bg-green-500/20 hover:bg-green-500/40 rounded-lg text-xs transition-colors">
                        <ThumbsUp size={12} /> 通过
                      </button>
                      <button onClick={() => onReviewItem('article', art.id, 'reject')}
                        className="flex items-center gap-1 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/40 rounded-lg text-xs transition-colors">
                        <ThumbsDown size={12} /> 打回
                      </button>
                    </div>
                  )}
                  {art.review.status === 'reject' && art.review.reason && (
                    <p className="text-xs text-red-400 mt-2">原因：{art.review.reason}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Videos */}
      <div>
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <span>🎬</span> 视频内容
          <span className="text-xs text-gray-500 font-normal">({videos.length}条)</span>
          {pendingVideos.length > 0 && <span className="text-xs text-yellow-400 font-normal">待审{pendingVideos.length}</span>}
          {passedVideos.length > 0 && <span className="text-xs text-green-400 font-normal">已过{passedVideos.length}</span>}
        </h3>
        <div className="grid gap-3">
          {videos.map(vid => (
            <div key={vid.id} className="bg-dark-card rounded-xl p-4 border border-dark-border">
              <div className="flex items-start gap-4">
                {vid.videoUrl ? (
                  <video src={vid.videoUrl} controls className="w-28 h-20 rounded-lg object-cover shrink-0 bg-dark-bg" />
                ) : (
                  <div className="w-20 h-20 rounded-lg bg-dark-bg flex items-center justify-center shrink-0">
                    <span>🎬</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium truncate">{vid.subject}</h4>
                    {vid.review.status === 'pass' && <CheckCircle2 size={14} className="text-green-400 shrink-0" />}
                    {vid.review.status === 'reject' && <XCircle size={14} className="text-red-400 shrink-0" />}
                    {vid.review.status === 'pending' && <Loader2 size={14} className="animate-spin text-yellow-400 shrink-0" />}
                    {vid.publishedTo.length > 0 && <Send size={14} className="text-blue-400 shrink-0" />}
                  </div>
                  {vid.script && <p className="text-sm text-gray-400 line-clamp-2">{vid.script}</p>}

                  {vid.review.status === 'pending' && (
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => onReviewItem('video', vid.id, 'approve')}
                        className="flex items-center gap-1 px-3 py-1.5 bg-green-500/20 hover:bg-green-500/40 rounded-lg text-xs transition-colors">
                        <ThumbsUp size={12} /> 通过
                      </button>
                      <button onClick={() => onReviewItem('video', vid.id, 'reject')}
                        className="flex items-center gap-1 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/40 rounded-lg text-xs transition-colors">
                        <ThumbsDown size={12} /> 打回
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
