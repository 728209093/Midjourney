import Link from "next/link";
import { FileText, History, Settings, Sparkles } from "lucide-react";

type HeaderProps = {
  onOpenSettings?: () => void;
};

export function Header({ onOpenSettings }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-ink/88 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="grid size-9 place-items-center rounded-md bg-mint text-ink shadow-soft">
            <Sparkles className="size-5" aria-hidden />
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-mint">
              AI Image Studio
            </p>
            <h1 className="text-base font-semibold text-white sm:text-lg">AI 生图工作台</h1>
          </div>
        </div>

        <nav className="flex items-center gap-2" aria-label="主导航">
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
