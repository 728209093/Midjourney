import Link from "next/link";
import { ExternalLink, FilePlus, FileText, History, Menu, Moon, Settings, Sparkles, Sun, Trash2 } from "lucide-react";

type HeaderProps = {
  onOpenSidebar?: () => void;
  onOpenSettings?: () => void;
  onNewChat?: () => void;
  onClearChat?: () => void;
  colorTheme?: "day" | "night";
  onToggleTheme?: () => void;
};

export function Header({ onOpenSidebar, onOpenSettings, onNewChat, onClearChat, colorTheme = "night", onToggleTheme }: HeaderProps) {
  const dayMode = colorTheme === "day";

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-ink/92 shadow-soft backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-2 px-3 sm:px-4 lg:gap-3 lg:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onOpenSidebar}
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-stone-200 transition hover:border-mint/50 hover:text-mint lg:hidden"
            title="打开聊天分组"
          >
            <Menu className="size-4" aria-hidden />
            <span className="sr-only">打开聊天分组</span>
          </button>
          <div className="hidden size-9 shrink-0 place-items-center rounded-md bg-mint text-ink shadow-soft sm:grid">
            <Sparkles className="size-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-mint sm:uppercase sm:tracking-[0.18em]">天晴了绘图</p>
          </div>
        </div>

        <nav className="flex shrink-0 items-center gap-1 sm:gap-2" aria-label="主导航">
          <button
            type="button"
            onClick={onNewChat}
            className="inline-flex size-9 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-stone-200 transition hover:border-mint/50 hover:text-mint sm:size-10"
            title="新建聊天"
          >
            <FilePlus className="size-4" aria-hidden />
            <span className="sr-only">新建聊天</span>
          </button>
          <button
            type="button"
            onClick={onClearChat}
            className="hidden size-9 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-stone-200 transition hover:border-coral/60 hover:text-coral sm:inline-flex sm:size-10"
            title="清空当前聊天"
          >
            <Trash2 className="size-4" aria-hidden />
            <span className="sr-only">清空当前聊天</span>
          </button>
          <Link
            href="/docs"
            className="hidden size-9 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-stone-200 transition hover:border-mint/50 hover:text-mint sm:inline-flex sm:size-10"
            title="说明文档"
          >
            <FileText className="size-4" aria-hidden />
            <span className="sr-only">说明文档</span>
          </Link>
          <a
            href="#history"
            className="hidden size-9 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-stone-200 transition hover:border-mint/50 hover:text-mint sm:inline-flex sm:size-10"
            title="历史记录"
          >
            <History className="size-4" aria-hidden />
            <span className="sr-only">历史记录</span>
          </a>
          <a
            href="https://dahlo.live/"
            target="_blank"
            rel="noreferrer"
            className="hidden size-9 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-stone-200 transition hover:border-mint/50 hover:text-mint sm:inline-flex sm:size-10"
            title="返回中转"
          >
            <ExternalLink className="size-4" aria-hidden />
            <span className="sr-only">返回中转</span>
          </a>
          <button
            type="button"
            onClick={onToggleTheme}
            className="inline-flex size-9 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-stone-200 transition hover:border-mint/50 hover:text-mint sm:size-10"
            title={dayMode ? "切换到夜间模式" : "切换到日间模式"}
            aria-pressed={dayMode}
          >
            {dayMode ? <Moon className="size-4" aria-hidden /> : <Sun className="size-4" aria-hidden />}
            <span className="sr-only">{dayMode ? "切换到夜间模式" : "切换到日间模式"}</span>
          </button>
          <button
            type="button"
            onClick={onOpenSettings}
            className="inline-flex size-9 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-stone-200 transition hover:border-mint/50 hover:text-mint sm:size-10"
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
