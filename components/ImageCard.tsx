"use client";

import { Download, Eye, RefreshCw, Trash2, X } from "lucide-react";
import { useState } from "react";

import { downloadImage, getImageSrc } from "@/lib/utils";
import type { GeneratedImage } from "@/types/image";

type ImageCardProps = {
  image: GeneratedImage;
  onDelete: (id: string) => void;
  onReuse: (image: GeneratedImage) => void;
};

export function ImageCard({ image, onDelete, onReuse }: ImageCardProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const src = getImageSrc(image);
  const createdAt = new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(image.createdAt));

  return (
    <>
      <article className="overflow-hidden rounded-lg border border-white/10 bg-panel shadow-soft">
        <button
          type="button"
          onClick={() => setPreviewOpen(true)}
          className="group block aspect-square w-full overflow-hidden bg-ink"
          title="查看大图"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={image.prompt}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
          />
        </button>

        <div className="space-y-3 p-3">
          <div>
            <p className="line-clamp-2 min-h-10 text-sm leading-5 text-white">{image.prompt}</p>
            <p className="mt-2 text-xs text-stone-400">
              {image.mode === "edit" ? "图生图" : "文生图"} ·{" "}
              {image.resolution?.toUpperCase() || "1K"} · {image.size} · {image.quality} · {createdAt}
            </p>
          </div>

          <div className="grid grid-cols-4 gap-2">
            <button
              type="button"
              onClick={() => downloadImage(src, `ai-image-${image.id}.png`)}
              className="grid size-9 place-items-center rounded-md border border-white/10 text-stone-300 transition hover:border-mint/50 hover:text-mint"
              title="下载"
            >
              <Download className="size-4" aria-hidden />
              <span className="sr-only">下载</span>
            </button>
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              className="grid size-9 place-items-center rounded-md border border-white/10 text-stone-300 transition hover:border-mint/50 hover:text-mint"
              title="查看大图"
            >
              <Eye className="size-4" aria-hidden />
              <span className="sr-only">查看大图</span>
            </button>
            <button
              type="button"
              onClick={() => onReuse(image)}
              className="grid size-9 place-items-center rounded-md border border-white/10 text-stone-300 transition hover:border-gold/60 hover:text-gold"
              title="重新使用参数"
            >
              <RefreshCw className="size-4" aria-hidden />
              <span className="sr-only">重新使用参数</span>
            </button>
            <button
              type="button"
              onClick={() => onDelete(image.id)}
              className="grid size-9 place-items-center rounded-md border border-white/10 text-stone-300 transition hover:border-coral/60 hover:text-coral"
              title="删除"
            >
              <Trash2 className="size-4" aria-hidden />
              <span className="sr-only">删除</span>
            </button>
          </div>
        </div>
      </article>

      {previewOpen ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/82 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          onClick={() => setPreviewOpen(false)}
        >
          <div className="relative max-h-[92vh] max-w-5xl" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              onClick={() => setPreviewOpen(false)}
              className="absolute right-3 top-3 z-10 grid size-10 place-items-center rounded-md bg-black/65 text-white transition hover:bg-black"
              title="关闭"
            >
              <X className="size-5" aria-hidden />
              <span className="sr-only">关闭</span>
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={image.prompt}
              className="max-h-[92vh] w-auto rounded-lg object-contain"
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
