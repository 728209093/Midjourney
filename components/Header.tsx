import Link from "next/link";
import { ExternalLink, FilePlus, FileText, History, Moon, Settings, Sparkles, Sun, Trash2 } from "lucide-react";

type HeaderProps = {
  onOpenSettings?: () => void;
  onNewChat?: () => void;
  onClearChat?: () => void;
  colorTheme?: "day" | "night";
  onToggleTheme?: () => void;
};

export function Header({ onOpenSettings, onNewChat, onClearChat, colorTheme = "night", onToggleTheme }: HeaderProps) {
  const dayMode = colorTheme === "day";

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-ink/92 shadow-soft backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-md bg-mint text-ink shadow-soft">
            <Sparkles className="size-5" aria-hidden />
          </div>
          <div className="hidden min-w-0 sm:block">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-mint">天晴了绘图</p>
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
            className="inline-flex size-9 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-stone-200 transition hover:border-coral/60 hover:text-coral sm:size-10"
            title="清空当前聊天"
          >
            <Trash2 className="size-4" aria-hidden />
            <span className="sr-only">清空当前聊天</span>
          </button>
          <Link
            href="/docs"
            className="inline-flex size-9 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-stone-200 transition hover:border-mint/50 hover:text-mint sm:size-10"
            title="说明文档"
          >
            <FileText className="size-4" aria-hidden />
            <span className="sr-only">说明文档</span>
          </Link>
          <a
            href="#history"
            className="inline-flex size-9 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-stone-200 transition hover:border-mint/50 hover:text-mint sm:size-10"
            title="历史记录"
          >
            <History className="size-4" aria-hidden />
            <span className="sr-only">历史记录</span>
          </a>
          <a
            href="https://dahlo.live/"
            target="_blank"
            rel="noreferrer"
            className="inline-flex size-9 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-stone-200 transition hover:border-mint/50 hover:text-mint sm:size-10"
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
