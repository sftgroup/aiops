import React, { useRef } from 'react';
import { X } from 'lucide-react';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface ShortcutGroup {
  title: string;
  items: { keys: string; desc: string }[];
}

const GROUPS: ShortcutGroup[] = [
  {
    title: '🎬 视频播放',
    items: [
      { keys: 'Space', desc: '播放 / 暂停' },
      { keys: '← / →', desc: '快退 / 快进 5 秒' },
      { keys: '↑ / ↓', desc: '音量增减' },
      { keys: 'M', desc: '静音切换' },
      { keys: 'F', desc: '全屏切换' },
      { keys: 'ESC', desc: '关闭视频弹窗' },
    ],
  },
  {
    title: '🌐 全局',
    items: [
      { keys: '? / Shift+/', desc: '显示本帮助面板' },
      { keys: 'ESC', desc: '关闭当前弹窗或抽屉' },
      { keys: 'Ctrl/Cmd + K', desc: '聚焦搜索框' },
    ],
  },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[24px] px-1.5 py-0.5 bg-dark-bg border border-dark-border rounded text-[11px] font-mono text-gray-300 leading-none">
      {children}
    </kbd>
  );
}

export default function KeyboardShortcutsHelp({ open, onClose }: Props) {
  const containerRef = useFocusTrap(open);

  if (!open) return null;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="快捷键帮助"
    >
      <div
        className="bg-dark-card border border-dark-border rounded-2xl w-full max-w-md mx-4 max-h-[85vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ──────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-dark-border shrink-0">
          <h3 className="font-semibold text-white flex items-center gap-2">
            ⌨️ 快捷键帮助
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-500 hover:text-white rounded-lg hover:bg-dark-hover transition-colors"
            aria-label="关闭快捷键帮助"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Shortcut list ────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {GROUPS.map((group) => (
            <section key={group.title}>
              <h4 className="text-xs font-medium text-gray-400 mb-2">{group.title}</h4>
              <div className="space-y-2">
                {group.items.map((item) => (
                  <div
                    key={item.keys}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-gray-300">{item.desc}</span>
                    <div className="flex items-center gap-1 shrink-0 ml-3">
                      {item.keys.split(' / ').map((k, i) => (
                        <React.Fragment key={k}>
                          {i > 0 && <span className="text-gray-600 text-xs">/</span>}
                          <Kbd>{k}</Kbd>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}

          <p className="text-[11px] text-gray-600 leading-relaxed border-t border-dark-border pt-3">
            💡 编辑文本时（输入框、文本框内）快捷键自动禁用，避免误触。
          </p>
        </div>
      </div>
    </div>
  );
}
