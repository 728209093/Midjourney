"use client";

import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  ChevronDown,
  ImagePlus,
  Loader2,
  RotateCcw,
  SendHorizontal,
  User,
  WandSparkles,
} from "lucide-react";

import { Header } from "@/components/Header";
import { SettingsDialog } from "@/components/SettingsDialog";
import { validateApiBaseUrl } from "@/lib/api-url";
import { cn } from "@/lib/utils";
import type {
  GenerateImageResponse,
  GeneratedImage,
  ImageApiConfig,
  ImageMode,
  ImageQuality,
  ImageResolution,
  ImageSize,
} from "@/types/image";

const HISTORY_KEY = "ai-image-studio-history";
const API_CONFIG_KEY = "ai-image-studio-api-config";
const MAX_HISTORY_ITEMS = 20;
const DEFAULT_API_CONFIG: ImageApiConfig = {
  apiUrl: "",
  apiKey: "",
  model: "gpt-image-2",
};

type ChatTurn = {
  id: string;
  prompt: string;
  images: GeneratedImage[];
  mode: ImageMode;
  size: ImageSize;
  resolution: ImageResolution;
  quality: ImageQuality;
  createdAt: string;
  status: "done" | "loading" | "error";
  error?: string;
};

type PersistedChatTurn = Omit<ChatTurn, "images"> & {
  imageCount: number;
};

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [size] = useState<ImageSize>("1024x1024");
  const [resolution, setResolution] = useState<ImageResolution>("1k");
  const [quality, setQuality] = useState<ImageQuality>("medium");
  const [count, setCount] = useState(1);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [apiConfig, setApiConfig] = useState<ImageApiConfig>(DEFAULT_API_CONFIG);
  const [referenceImage, setReferenceImage] = useState<File | null>(null);
  const [referenceImageSource, setReferenceImageSource] = useState("");
  const [referencePreviewUrl, setReferencePreviewUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [settingsMessage, setSettingsMessage] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [referenceAction, setReferenceAction] = useState<"attach" | "replace">("attach");
  const bottomRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const canGenerate = useMemo(() => prompt.trim().length > 0 && !loading, [prompt, loading]);

  useEffect(() => {
    if (!referenceImage) {
      setReferencePreviewUrl(referenceImageSource || "");
      return;
    }

    const objectUrl = URL.createObjectURL(referenceImage);
    setReferencePreviewUrl(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [referenceImage, referenceImageSource]);

  useEffect(() => {
    try {
      const rawHistory = window.localStorage.getItem(HISTORY_KEY);
      if (rawHistory) {
        const history = JSON.parse(rawHistory) as PersistedChatTurn[];
        if (Array.isArray(history)) {
          setTurns(history.slice(0, MAX_HISTORY_ITEMS).map((turn) => ({ ...turn, images: [] })));
        }
      }
    } catch {
      window.localStorage.removeItem(HISTORY_KEY);
    }

    setHistoryLoaded(true);

    try {
      const rawConfig = window.localStorage.getItem(API_CONFIG_KEY);
      if (rawConfig) {
        const config = JSON.parse(rawConfig) as Partial<ImageApiConfig>;
        setApiConfig({
          apiUrl: typeof config.apiUrl === "string" ? config.apiUrl : "",
          apiKey: typeof config.apiKey === "string" ? config.apiKey : "",
          model: typeof config.model === "string" && config.model ? config.model : "gpt-image-2",
        });
      }
    } catch {
      window.localStorage.removeItem(API_CONFIG_KEY);
    }
  }, []);

  useEffect(() => {
    if (historyLoaded) {
      persistChatTurns(turns);
    }
  }, [historyLoaded, turns]);

  useEffect(() => {
    const container = chatRef.current;
    if (!container) {
      return;
    }

    const onScroll = () => {
      const distance = container.scrollHeight - container.scrollTop - container.clientHeight;
      setShowScrollButton(distance > 180);
    };

    onScroll();
    container.addEventListener("scroll", onScroll, { passive: true });
    return () => container.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns, loading]);

  async function handleGenerate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!prompt.trim()) {
      setError("请先输入提示词。");
      return;
    }

    const turnId = createChatTurnId();
    const createdAt = new Date().toISOString();
    const promptText = prompt.trim();
    const effectiveMode: ImageMode = referenceImage || referenceImageSource ? "edit" : "generate";

    setLoading(true);
    setError("");
    setTurns((current) => [
      ...current,
      {
        id: turnId,
        prompt: promptText,
        images: [],
        mode: effectiveMode,
        size,
        resolution,
        quality,
        createdAt,
        status: "loading",
      },
    ]);

    try {
      const apiConfigPayload = normalizeApiConfig(apiConfig);
      const response =
        effectiveMode === "edit" && referenceImage
          ? await fetch("/api/generate-image", {
              method: "POST",
              body: buildImageEditFormData({
                prompt: promptText,
                size,
                resolution,
                quality,
                count,
                apiConfig: apiConfigPayload,
                image: referenceImage,
              }),
            })
          : effectiveMode === "edit" && referenceImageSource
            ? await fetch("/api/generate-image", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  prompt: promptText,
                  size,
                  resolution,
                  quality,
                  n: count,
                  apiConfig: apiConfigPayload,
                  referenceImageUrl: referenceImageSource,
                }),
              })
            : await fetch("/api/generate-image", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  prompt: promptText,
                  size,
                  resolution,
                  quality,
                  n: count,
                  apiConfig: apiConfigPayload,
                }),
              });

      const data = (await response.json()) as GenerateImageResponse;

      if (!data.success) {
        throw new Error(data.message);
      }

      setTurns((current) =>
        current.map((turn) =>
          turn.id === turnId ? { ...turn, images: data.images, status: "done" } : turn,
        ),
      );

      if (referenceAction === "replace" && effectiveMode === "edit") {
        setReferenceImage(null);
        setReferenceImageSource("");
      }
      setPrompt("");
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "图片生成失败，请稍后重试。";
      setTurns((current) =>
        current.map((turn) => (turn.id === turnId ? { ...turn, status: "error", error: message } : turn)),
      );
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  function handleDeleteTurn(id: string) {
    setTurns((current) => current.filter((turn) => turn.id !== id));
  }

  function scrollToComposer() {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }

  function handleReuse(image: GeneratedImage) {
    setPrompt(image.prompt);
    setResolution(image.resolution || "1k");
    setQuality(image.quality);
    scrollToComposer();
  }

  async function handleContinueEdit(image: GeneratedImage) {
    const src = getImageSrc(image);
    const file = await buildReferenceFileFromImage(image, src);
    setPrompt(image.prompt);
    setReferenceAction("attach");
    setReferenceImageSource(src);
    setReferenceImage(file);
    setReferencePreviewUrl(src);
    scrollToComposer();
  }

  function handleSaveApiConfig() {
    try {
      const config = normalizeApiConfig(apiConfig);
      window.localStorage.setItem(API_CONFIG_KEY, JSON.stringify(config));
      setApiConfig({
        apiUrl: config.apiUrl || "",
        apiKey: config.apiKey || "",
        model: config.model || "gpt-image-2",
      });
      setSettingsMessage("API 设置已保存。");
      window.setTimeout(() => setSettingsMessage(""), 1600);
    } catch (saveError) {
      setSettingsMessage(saveError instanceof Error ? saveError.message : "API 设置保存失败。");
    }
  }

  function handleResetApiConfig() {
    window.localStorage.removeItem(API_CONFIG_KEY);
    setApiConfig(DEFAULT_API_CONFIG);
    setSettingsMessage("已清除本地 API 设置。");
    window.setTimeout(() => setSettingsMessage(""), 1600);
  }

  function handleReferenceImageChange(file: File | null) {
    setReferenceImage(file);
    if (file) {
      setReferenceImageSource("");
      return;
    }

    setReferenceImageSource("");
  }

  return (
    <main className="flex h-screen flex-col overflow-hidden">
      <Header onOpenSettings={() => setSettingsOpen(true)} />
      <SettingsDialog
        open={settingsOpen}
        apiConfig={apiConfig}
        message={settingsMessage}
        disabled={loading}
        onApiConfigChange={setApiConfig}
        onSave={handleSaveApiConfig}
        onReset={handleResetApiConfig}
        onClose={() => setSettingsOpen(false)}
      >
        <ParameterSettings
          resolution={resolution}
          quality={quality}
          count={count}
          loading={loading}
          referenceImage={referenceImage}
          referencePreviewUrl={referencePreviewUrl}
          referenceAction={referenceAction}
          onResolutionChange={setResolution}
          onQualityChange={setQuality}
          onCountChange={setCount}
          onReferenceImageChange={handleReferenceImageChange}
          onReferenceActionChange={setReferenceAction}
        />
      </SettingsDialog>

      <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col px-4 py-4 sm:px-6">
        <section
          ref={chatRef}
          className="min-h-0 flex-1 space-y-5 overflow-y-auto rounded-lg border border-white/10 bg-panel/55 p-4 shadow-soft"
        >
          {turns.length === 0 ? <EmptyChatState /> : null}

          {turns.map((turn) => (
            <article key={turn.id} className="space-y-3">
              <div className="flex flex-row-reverse items-start gap-3">
                <Avatar icon={<User className="size-4" aria-hidden />} />
                <div className="max-w-[min(42rem,82vw)] rounded-2xl rounded-tr-md border border-mint/30 bg-mint px-4 py-3 text-ink">
                  <p className="whitespace-pre-wrap text-sm leading-6">{turn.prompt}</p>
                  <div className="mt-2 flex flex-wrap items-center justify-end gap-2 text-[11px] text-ink/70">
                    <span>{turn.mode === "edit" ? "图生图" : "文生图"}</span>
                    <span>{turn.size}</span>
                    <span>{turn.resolution.toUpperCase()}</span>
                    <span>{turn.quality}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Avatar icon={<Bot className="size-4" aria-hidden />} />
                <div className="min-w-0 max-w-[min(56rem,86vw)] flex-1 rounded-2xl rounded-tl-md border border-white/10 bg-ink/70 p-3">
                  {turn.status === "loading" ? <LoadingBubble count={count} /> : null}
                  {turn.status === "error" ? <p className="text-sm leading-6 text-rose-200">{turn.error}</p> : null}
                  {turn.status === "done" ? (
                    <div className="space-y-3">
                      <p className="text-xs text-stone-400">已生成 {turn.images.length} 张图片</p>
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {turn.images.map((image) => (
                          <GeneratedImageCard
                            key={image.id}
                            image={image}
                            onContinueEdit={handleContinueEdit}
                            onReuse={handleReuse}
                          />
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => handleDeleteTurn(turn.id)}
                  className="text-xs text-stone-500 transition hover:text-stone-300"
                >
                  删除这一轮
                </button>
              </div>
            </article>
          ))}

          <div ref={bottomRef} />
        </section>

        <section id="composer" className="mt-4 rounded-lg border border-white/10 bg-panel/80 p-3 shadow-soft">
          <form onSubmit={handleGenerate} className="space-y-3">
            {referencePreviewUrl ? (
              <div className="flex items-center gap-3 rounded-md border border-white/10 bg-white/[0.03] p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={referencePreviewUrl} alt="参考图预览" className="size-12 rounded-md object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-white">正在基于参考图继续修改</p>
                  <p className="truncate text-xs text-stone-400">参数可在右上角设置中调整</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setReferenceImage(null);
                    setReferenceImageSource("");
                  }}
                  className="text-xs text-stone-400 transition hover:text-coral"
                >
                  移除
                </button>
              </div>
            ) : null}

            <div className="flex items-end gap-3">
              <textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
                disabled={loading}
                maxLength={2000}
                rows={2}
                placeholder="输入你想生成或修改的画面..."
                className="min-h-[56px] flex-1 resize-none rounded-md border border-white/10 bg-ink/70 px-3 py-3 text-sm leading-6 text-white placeholder:text-stone-500 transition focus:border-mint disabled:cursor-not-allowed disabled:opacity-60"
              />
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                disabled={loading}
                className={cn(
                  "inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-md border transition",
                  referencePreviewUrl
                    ? "border-mint/50 bg-mint/10 text-mint hover:bg-mint hover:text-ink"
                    : "border-white/10 bg-white/[0.04] text-stone-200 hover:border-mint/50 hover:text-mint",
                  loading ? "cursor-not-allowed opacity-60" : "",
                )}
                title="添加图片"
              >
                <ImagePlus className="size-5" aria-hidden />
                <span className="sr-only">添加图片</span>
              </button>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  handleReferenceImageChange(event.target.files?.[0] || null);
                  event.currentTarget.value = "";
                }}
                disabled={loading}
              />
              <button
                type="submit"
                disabled={!canGenerate}
                className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-mint text-ink transition hover:bg-teal-200 disabled:cursor-not-allowed disabled:bg-stone-600 disabled:text-stone-300"
                title="发送"
              >
                {loading ? (
                  <Loader2 className="size-5 animate-spin" aria-hidden />
                ) : (
                  <SendHorizontal className="size-5" aria-hidden />
                )}
                <span className="sr-only">发送</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-stone-400">
              <span>Enter 发送，Shift+Enter 换行</span>
              <button type="button" onClick={() => setSettingsOpen(true)} className="transition hover:text-mint">
                参数设置
              </button>
            </div>
            {error ? <p className="text-sm text-rose-200">{error}</p> : null}
          </form>
        </section>
      </div>

      {showScrollButton ? (
        <button
          type="button"
          onClick={() => bottomRef.current?.scrollIntoView({ behavior: "smooth" })}
          className="fixed bottom-28 right-4 z-30 inline-flex items-center gap-2 rounded-full border border-white/10 bg-ink/90 px-4 py-2 text-sm text-white shadow-soft backdrop-blur"
        >
          <ChevronDown className="size-4" aria-hidden />
          回到底部
        </button>
      ) : null}
    </main>
  );
}

function ParameterSettings({
  resolution,
  quality,
  count,
  loading,
  referenceImage,
  referencePreviewUrl,
  referenceAction,
  onResolutionChange,
  onQualityChange,
  onCountChange,
  onReferenceImageChange,
  onReferenceActionChange,
}: {
  resolution: ImageResolution;
  quality: ImageQuality;
  count: number;
  loading: boolean;
  referenceImage: File | null;
  referencePreviewUrl: string;
  referenceAction: "attach" | "replace";
  onResolutionChange: (value: ImageResolution) => void;
  onQualityChange: (value: ImageQuality) => void;
  onCountChange: (value: number) => void;
  onReferenceImageChange: (value: File | null) => void;
  onReferenceActionChange: (value: "attach" | "replace") => void;
}) {
  return (
    <section className="rounded-lg border border-white/10 bg-panel/86 p-4 shadow-soft">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-white">生成参数</h2>
          <p className="mt-1 text-xs text-stone-400">影响下一次发送的图片结果</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-xs leading-5 text-stone-300">
          不添加图片就是文生图；添加图片后会自动按图生图发送。
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-stone-300">分辨率</p>
          <div className="grid grid-cols-3 gap-2">
            {(["1k", "2k", "4k"] as const).map((item) => (
              <ModeChip
                key={item}
                label={item.toUpperCase()}
                active={resolution === item}
                onClick={() => onResolutionChange(item)}
              />
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-stone-300">质量</p>
          <div className="grid grid-cols-3 gap-2">
            {(["low", "medium", "high"] as const).map((item) => (
              <ModeChip key={item} label={item} active={quality === item} onClick={() => onQualityChange(item)} />
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-stone-400">
            <span>数量</span>
            <span className="text-white">{count}</span>
          </div>
          <input
            type="range"
            min={1}
            max={4}
            value={count}
            onChange={(event) => onCountChange(Number(event.target.value))}
            disabled={loading}
            className="w-full accent-mint"
          />
        </div>

        <div className="space-y-3 rounded-md border border-white/10 bg-ink/50 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-white">参考图</p>
            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => onReferenceActionChange("attach")}
                className={cn(
                  "rounded-md px-2 py-1 transition",
                  referenceAction === "attach" ? "bg-mint text-ink" : "border border-white/10 text-stone-300",
                )}
              >
                附加
              </button>
              <button
                type="button"
                onClick={() => onReferenceActionChange("replace")}
                className={cn(
                  "rounded-md px-2 py-1 transition",
                  referenceAction === "replace" ? "bg-mint text-ink" : "border border-white/10 text-stone-300",
                )}
              >
                替换
              </button>
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-3 rounded-md border border-dashed border-white/15 bg-white/[0.03] px-3 py-3 text-sm text-stone-300 transition hover:border-mint/50 hover:text-white">
            <ImagePlus className="size-4 text-mint" aria-hidden />
            <span className="min-w-0 truncate">{referenceImage ? referenceImage.name : "上传一张图用于图生图"}</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => onReferenceImageChange(event.target.files?.[0] || null)}
              disabled={loading}
            />
          </label>

          {referencePreviewUrl ? (
            <div className="space-y-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={referencePreviewUrl} alt="参考图预览" className="max-h-44 w-full rounded-md object-cover" />
              <button
                type="button"
                onClick={() => onReferenceImageChange(null)}
                className="text-xs text-stone-400 transition hover:text-coral"
              >
                移除参考图
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function EmptyChatState() {
  return (
    <div className="grid min-h-[320px] place-items-center rounded-lg border border-dashed border-white/15 bg-white/[0.03] p-8 text-center">
      <div className="max-w-md">
        <div className="mx-auto grid size-14 place-items-center rounded-md bg-white/[0.06] text-mint">
          <Bot className="size-6" aria-hidden />
        </div>
        <h2 className="mt-4 text-lg font-semibold text-white">还没有对话</h2>
        <p className="mt-2 text-sm leading-6 text-stone-400">输入一句描述，结果会像聊天回复一样出现在左侧。</p>
      </div>
    </div>
  );
}

function Avatar({ icon }: { icon: ReactNode }) {
  return (
    <div className="grid size-9 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.05] text-stone-200">
      {icon}
    </div>
  );
}

function ModeChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-10 rounded-md border px-2 text-sm transition",
        active
          ? "border-mint bg-mint text-ink"
          : "border-white/10 bg-white/[0.03] text-stone-300 hover:border-mint/50",
      )}
    >
      {label}
    </button>
  );
}

function LoadingBubble({ count }: { count: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="aspect-square animate-pulse rounded-lg border border-white/10 bg-white/[0.05]" />
      ))}
    </div>
  );
}

function GeneratedImageCard({
  image,
  onContinueEdit,
  onReuse,
}: {
  image: GeneratedImage;
  onContinueEdit: (image: GeneratedImage) => void;
  onReuse: (image: GeneratedImage) => void;
}) {
  const src = getImageSrc(image);

  return (
    <div className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.03]">
      <button
        type="button"
        onClick={() => onReuse(image)}
        className="block w-full text-left transition hover:bg-white/[0.04]"
        title="点击复用这张图的参数"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={image.prompt} className="aspect-square w-full object-cover" />
      </button>
      <div className="space-y-2 border-t border-white/10 p-2">
        <p className="line-clamp-2 text-xs leading-5 text-stone-300">{image.prompt}</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onContinueEdit(image)}
            className="inline-flex flex-1 items-center justify-center gap-1 rounded-md border border-mint/40 bg-mint/10 px-2 py-1.5 text-xs font-medium text-mint transition hover:bg-mint hover:text-ink"
          >
            <WandSparkles className="size-3.5" aria-hidden />
            继续改图
          </button>
          <button
            type="button"
            onClick={() => onReuse(image)}
            className="inline-flex items-center justify-center gap-1 rounded-md border border-white/10 px-2 py-1.5 text-xs text-stone-300 transition hover:border-mint/50 hover:text-white"
          >
            <RotateCcw className="size-3.5" aria-hidden />
            复用参数
          </button>
        </div>
      </div>
    </div>
  );
}

function buildImageEditFormData({
  prompt,
  size,
  resolution,
  quality,
  count,
  apiConfig,
  image,
}: {
  prompt: string;
  size: ImageSize;
  resolution: ImageResolution;
  quality: ImageQuality;
  count: number;
  apiConfig: Partial<ImageApiConfig>;
  image: File;
}) {
  const formData = new FormData();
  formData.append("prompt", prompt);
  formData.append("size", size);
  formData.append("resolution", resolution);
  formData.append("quality", quality);
  formData.append("n", String(count));
  formData.append("apiConfig", JSON.stringify(apiConfig));
  formData.append("image", image);
  return formData;
}

function persistChatTurns(turns: ChatTurn[]) {
  const storedTurns = turns.slice(0, MAX_HISTORY_ITEMS).map(({ images, ...turn }) => ({
    ...turn,
    imageCount: images.length,
  }));

  try {
    if (storedTurns.length === 0) {
      window.localStorage.removeItem(HISTORY_KEY);
      return;
    }

    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(storedTurns));
  } catch (error) {
    if (!isStorageQuotaError(error)) {
      return;
    }

    window.localStorage.removeItem(HISTORY_KEY);
  }
}

function isStorageQuotaError(error: unknown) {
  return (
    error instanceof DOMException &&
    (error.name === "QuotaExceededError" ||
      error.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
      error.code === 22 ||
      error.code === 1014)
  );
}

function normalizeApiConfig(config: ImageApiConfig): Partial<ImageApiConfig> {
  const apiUrl = config.apiUrl.trim();
  const apiKey = config.apiKey.trim();
  const model = config.model.trim();

  if (apiUrl) {
    const validated = validateApiBaseUrl(apiUrl);
    if (!validated.ok) {
      throw new Error(validated.message);
    }
  }

  return {
    ...(apiUrl ? { apiUrl } : {}),
    ...(apiKey ? { apiKey } : {}),
    ...(model ? { model } : {}),
  };
}

function createChatTurnId() {
  return `turn_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function getImageSrc(image: GeneratedImage) {
  if (image.url) {
    return image.url;
  }

  if (image.base64) {
    return image.base64.startsWith("data:") ? image.base64 : `data:image/png;base64,${image.base64}`;
  }

  return "";
}

async function buildReferenceFileFromImage(image: GeneratedImage, src: string) {
  const fileName = `reference-${image.id}.png`;

  if (image.base64) {
    const blob = base64ToBlob(image.base64);
    return new File([blob], fileName, { type: blob.type || "image/png" });
  }

  if (!src) {
    return null;
  }

  try {
    const response = await fetch(src);
    if (!response.ok) {
      return null;
    }

    const blob = await response.blob();
    return new File([blob], fileName, { type: blob.type || "image/png" });
  } catch {
    return null;
  }
}

function base64ToBlob(input: string) {
  const raw = input.startsWith("data:") ? input.split(",")[1] || "" : input;
  const binary = atob(raw);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: "image/png" });
}
