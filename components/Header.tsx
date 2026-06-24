import Link from "next/link";
import { FilePlus, FileText, History, Settings, Sparkles, Trash2 } from "lucide-react";

type HeaderProps = {
  onOpenSettings?: () => void;
  onNewChat?: () => void;
  onClearChat?: () => void;
};

export function Header({ onOpenSettings, onNewChat, onClearChat }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-ink/88 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="grid size-9 place-items-center rounded-md bg-mint text-ink shadow-soft">
            <Sparkles className="size-5" aria-hidden />
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-mint">天晴了绘图</p>
          </div>
        </div>

        <nav className="flex items-center gap-2" aria-label="主导航">
          <button
            type="button"
            onClick={onNewChat}
            className="inline-flex size-10 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-stone-200 transition hover:border-mint/50 hover:text-mint"
            title="新建聊天"
          >
            <FilePlus className="size-4" aria-hidden />
            <span className="sr-only">新建聊天</span>
          </button>
          <button
            type="button"
            onClick={onClearChat}
            className="inline-flex size-10 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-stone-200 transition hover:border-coral/60 hover:text-coral"
            title="清空当前聊天"
          >
            <Trash2 className="size-4" aria-hidden />
            <span className="sr-only">清空当前聊天</span>
          </button>
          <Link
            href="/docs"
            className="inline-flex size-10 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-stone-200 transition hover:border-mint/50 hover:text-mint"
            title="说明文档"
          >
            <FileText className="size-4" aria-hidden />
            <span className="sr-only">说明文档</span>
          </Link>
          <a
            href="#history"
            className="inline-flex size-10 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-stone-200 transition hover:border-mint/50 hover:text-mint"
            title="历史记录"
          >
            <History className="size-4" aria-hidden />
            <span className="sr-only">历史记录</span>
          </a>
          <button
            type="button"
            onClick={onOpenSettings}
            className="inline-flex size-10 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-stone-200 transition hover:border-mint/50 hover:text-mint"
            title="设置"
          >
            <Settings className="size-4" aria-hidden />
            <span className="sr-only">设置</span>
          </button>
        </nav>
      </div>
    </header>
  );
}
