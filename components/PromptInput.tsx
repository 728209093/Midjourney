import { Eraser, WandSparkles } from "lucide-react";

type PromptInputProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

const examples = [
  "一只穿宇航服的橘猫站在月球表面，电影级光影，超高清真实摄影风格",
  "雨夜东京街头的未来感跑车，霓虹灯反射，赛博朋克，低机位镜头",
  "极简产品摄影，一只透明玻璃香水瓶，柔和晨光，浅色背景，高级质感",
];

export function PromptInput({ value, onChange, disabled }: PromptInputProps) {
  return (
    <section className="rounded-lg border border-white/10 bg-panel/86 p-4 shadow-soft">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-white">Prompt</h2>
          <p className="mt-1 text-xs text-stone-400">{value.length}/2000</p>
        </div>
        <button
          type="button"
          onClick={() => onChange("")}
          disabled={disabled || !value}
          className="inline-flex size-9 items-center justify-center rounded-md border border-white/10 text-stone-300 transition hover:border-coral/60 hover:text-coral disabled:cursor-not-allowed disabled:opacity-40"
          title="清空"
        >
          <Eraser className="size-4" aria-hidden />
          <span className="sr-only">清空</span>
        </button>
      </div>

      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        maxLength={2000}
        rows={9}
        placeholder="描述你想生成的图片，例如：一间靠海的现代书房，清晨阳光，真实摄影风格..."
        className="min-h-[216px] w-full resize-none rounded-md border border-white/10 bg-ink/70 px-3 py-3 text-sm leading-6 text-white placeholder:text-stone-500 transition focus:border-mint disabled:cursor-not-allowed disabled:opacity-60"
      />

      <div className="mt-4 space-y-2">
        <div className="flex items-center gap-2 text-xs font-medium text-stone-300">
          <WandSparkles className="size-4 text-gold" aria-hidden />
          示例
        </div>
        <div className="grid gap-2">
          {examples.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => onChange(example)}
              disabled={disabled}
              className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-left text-xs leading-5 text-stone-300 transition hover:border-mint/50 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {example}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
