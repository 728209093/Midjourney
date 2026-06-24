import { ImagePlus } from "lucide-react";

export function EmptyState() {
  return (
    <div className="grid min-h-[420px] place-items-center rounded-lg border border-dashed border-white/15 bg-white/[0.03] p-8 text-center">
      <div>
        <div className="mx-auto grid size-16 place-items-center rounded-md bg-white/[0.06] text-mint">
          <ImagePlus className="size-7" aria-hidden />
        </div>
        <h2 className="mt-5 text-lg font-semibold text-white">等待第一张作品</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-stone-400">
          输入描述、选择尺寸和质量后开始生成，结果会显示在这里并自动保存到本地历史。
        </p>
      </div>
    </div>
  );
}
