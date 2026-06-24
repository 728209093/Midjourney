import { Loader2, Sparkles } from "lucide-react";

type GenerateButtonProps = {
  loading: boolean;
  disabled?: boolean;
};

export function GenerateButton({ loading, disabled }: GenerateButtonProps) {
  return (
    <button
      type="submit"
      disabled={disabled || loading}
      className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-mint px-4 text-sm font-semibold text-ink shadow-soft transition hover:bg-teal-200 disabled:cursor-not-allowed disabled:bg-stone-600 disabled:text-stone-300"
    >
      {loading ? (
        <Loader2 className="size-4 animate-spin" aria-hidden />
      ) : (
        <Sparkles className="size-4" aria-hidden />
      )}
      {loading ? "正在生成..." : "生成图片"}
    </button>
  );
}
