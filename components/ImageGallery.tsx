"use client";

import { AlertCircle } from "lucide-react";

import { EmptyState } from "@/components/EmptyState";
import { ImageCard } from "@/components/ImageCard";
import { LoadingState } from "@/components/LoadingState";
import type { GeneratedImage } from "@/types/image";

type ImageGalleryProps = {
  images: GeneratedImage[];
  loading: boolean;
  loadingCount: number;
  error: string;
  onDelete: (id: string) => void;
  onReuse: (image: GeneratedImage) => void;
};

export function ImageGallery({
  images,
  loading,
  loadingCount,
  error,
  onDelete,
  onReuse,
}: ImageGalleryProps) {
  return (
    <section className="rounded-lg border border-white/10 bg-panel/68 p-4 shadow-soft">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-white">生成结果</h2>
          <p className="mt-1 text-xs text-stone-400">{images.length} 张图片保存在本地历史</p>
        </div>
      </div>

      {error ? (
        <div className="mb-4 flex items-start gap-3 rounded-md border border-coral/30 bg-coral/10 p-3 text-sm text-rose-100">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>{error}</p>
        </div>
      ) : null}

      {loading ? <LoadingState count={loadingCount} /> : null}

      {!loading && images.length === 0 ? <EmptyState /> : null}

      {images.length > 0 ? (
        <div id="history" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {images.map((image) => (
            <ImageCard key={image.id} image={image} onDelete={onDelete} onReuse={onReuse} />
          ))}
        </div>
      ) : null}
    </section>
  );
}
