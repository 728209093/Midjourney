"use client";

import { ImagePlus, X } from "lucide-react";

type ReferenceImageInputProps = {
  file: File | null;
  previewUrl: string;
  onChange: (file: File | null) => void;
  disabled?: boolean;
};

export function ReferenceImageInput({
  file,
  previewUrl,
  onChange,
  disabled,
}: ReferenceImageInputProps) {
  return (
    <section className="rounded-lg border border-white/10 bg-panel/86 p-4 shadow-soft">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-white">参考图片</h2>
          <p className="mt-1 text-xs text-stone-400">PNG、JPG、WEBP，最大 10MB</p>
        </div>
        {file ? (
          <button
            type="button"
            onClick={() => onChange(null)}
            disabled={disabled}
            className="grid size-9 place-items-center rounded-md border border-white/10 text-stone-300 transition hover:border-coral/60 hover:text-coral disabled:cursor-not-allowed disabled:opacity-60"
            title="移除参考图"
          >
            <X className="size-4" aria-hidden />
            <span className="sr-only">移除参考图</span>
          </button>
        ) : null}
      </div>

      <label className="block cursor-pointer">
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={disabled}
          onChange={(event) => onChange(event.target.files?.[0] || null)}
          className="sr-only"
        />
        {previewUrl ? (
          <div className="overflow-hidden rounded-md border border-white/10 bg-ink">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewUrl} alt="参考图片预览" className="aspect-square w-full object-cover" />
          </div>
        ) : (
          <div className="grid min-h-40 place-items-center rounded-md border border-dashed border-white/15 bg-white/[0.03] px-4 py-6 text-center transition hover:border-mint/50">
            <div>
              <div className="mx-auto grid size-12 place-items-center rounded-md bg-white/[0.06] text-mint">
                <ImagePlus className="size-5" aria-hidden />
              </div>
              <p className="mt-3 text-sm font-medium text-white">上传参考图</p>
              <p className="mt-1 text-xs text-stone-500">用于图生图或局部风格迁移</p>
            </div>
          </div>
        )}
      </label>

      {file ? <p className="mt-3 truncate text-xs text-stone-400">{file.name}</p> : null}
    </section>
  );
}
