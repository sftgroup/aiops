import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-[#0f0f1a] flex items-center justify-center">
      <div className="text-center px-6">
        <div className="text-8xl font-bold bg-gradient-to-r from-[#6366f1] to-[#a855f7] bg-clip-text text-transparent mb-6">
          404
        </div>
        <h1 className="text-2xl font-semibold text-white mb-3">页面未找到</h1>
        <p className="text-gray-400 mb-8 max-w-md mx-auto">
          您访问的页面不存在或已被移除。请检查 URL 是否正确。
        </p>
        <div className="flex gap-4 justify-center">
          <Link to="/" className="bg-[#6366f1] text-white px-6 py-2.5 rounded-lg hover:bg-[#5558e6] transition-colors text-sm font-medium">
            返回首页
          </Link>
          <Link to="/dashboard" className="bg-[#1a1a2e] text-gray-300 px-6 py-2.5 rounded-lg hover:bg-[#252540] transition-colors text-sm font-medium border border-gray-700">
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
