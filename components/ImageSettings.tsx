import { Gauge, Images, Ruler } from "lucide-react";

import { IMAGE_ASPECT_RATIO_OPTIONS, formatImageSize } from "@/lib/image-size";
import { IMAGE_QUALITIES, IMAGE_RESOLUTIONS } from "@/lib/validators";
import type { ImageAspectRatio, ImageMode, ImageQuality, ImageResolution, ImageSize } from "@/types/image";

type ImageSettingsProps = {
  mode: ImageMode;
  size: ImageSize;
  aspectRatio: ImageAspectRatio;
  resolution: ImageResolution;
  quality: ImageQuality;
  count: number;
  onAspectRatioChange: (value: ImageAspectRatio) => void;
  onModeChange: (value: ImageMode) => void;
  onResolutionChange: (value: ImageResolution) => void;
  onQualityChange: (value: ImageQuality) => void;
  onCountChange: (value: number) => void;
  disabled?: boolean;
};

const qualityLabels: Record<ImageQuality, string> = {
  low: "快速",
  medium: "均衡",
  high: "精细",
};

export function ImageSettings({
  mode,
  aspectRatio,
  resolution,
  quality,
  count,
  onModeChange,
  onAspectRatioChange,
  onResolutionChange,
  onQualityChange,
  onCountChange,
  disabled,
}: ImageSettingsProps) {
  return (
    <section id="settings" className="rounded-lg border border-white/10 bg-panel/86 p-4 shadow-soft">
      <h2 className="mb-4 text-sm font-semibold text-white">生成参数</h2>

      <div className="space-y-5">
        <div>
          <label className="mb-2 flex items-center gap-2 text-xs font-medium text-stone-300">
            <Images className="size-4 text-mint" aria-hidden />
            生成模式
          </label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { value: "generate" as const, label: "文生图" },
              { value: "edit" as const, label: "图生图" },
            ].map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => onModeChange(item.value)}
                disabled={disabled}
                className={`h-10 rounded-md border px-2 text-sm transition disabled:cursor-not-allowed disabled:opacity-60 ${
                  mode === item.value
                    ? "border-mint bg-mint text-ink"
                    : "border-white/10 bg-white/[0.03] text-stone-300 hover:border-mint/50"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-2 flex items-center gap-2 text-xs font-medium text-stone-300">
            <Ruler className="size-4 text-mint" aria-hidden />
            画幅比例
          </label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {IMAGE_ASPECT_RATIO_OPTIONS.map((item) => (
              <button
                key={item.ratio}
                type="button"
                onClick={() => onAspectRatioChange(item.ratio)}
                disabled={disabled}
                className={`rounded-md border px-2 py-2 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-60 ${
                  aspectRatio === item.ratio
                    ? "border-mint bg-mint text-ink"
                    : "border-white/10 bg-white/[0.03] text-stone-300 hover:border-mint/50"
                }`}
              >
                <span className="block font-medium">{item.label}</span>
                <span className={`mt-1 block text-[11px] ${aspectRatio === item.ratio ? "text-ink/75" : "text-stone-500"}`}>
                  {formatImageSize(item.size)}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-2 flex items-center gap-2 text-xs font-medium text-stone-300">
            <Ruler className="size-4 text-gold" aria-hidden />
            分辨率
          </label>
          <div className="grid grid-cols-3 gap-2">
            {IMAGE_RESOLUTIONS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => onResolutionChange(item)}
                disabled={disabled}
                className={`h-10 rounded-md border px-2 text-sm uppercase transition disabled:cursor-not-allowed disabled:opacity-60 ${
                  resolution === item
                    ? "border-mint bg-mint text-ink"
                    : "border-white/10 bg-white/[0.03] text-stone-300 hover:border-mint/50"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-2 flex items-center gap-2 text-xs font-medium text-stone-300">
            <Gauge className="size-4 text-coral" aria-hidden />
            图片质量
          </label>
          <div className="grid grid-cols-3 gap-2">
            {IMAGE_QUALITIES.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => onQualityChange(item)}
                disabled={disabled}
                className={`h-10 rounded-md border px-2 text-sm transition disabled:cursor-not-allowed disabled:opacity-60 ${
                  quality === item
                    ? "border-mint bg-mint text-ink"
                    : "border-white/10 bg-white/[0.03] text-stone-300 hover:border-mint/50"
                }`}
              >
                {qualityLabels[item]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-2 flex items-center gap-2 text-xs font-medium text-stone-300">
            <Images className="size-4 text-gold" aria-hidden />
            生成数量
          </label>
          <input
            type="range"
            min={1}
            max={9}
            value={count}
            onChange={(event) => onCountChange(Number(event.target.value))}
            disabled={disabled}
            className="w-full accent-mint"
          />
          <div className="mt-2 flex justify-between text-xs text-stone-400">
            <span>1 张</span>
            <span className="font-semibold text-white">{count} 张</span>
            <span>9 张</span>
          </div>
        </div>
      </div>
    </section>
  );
}
