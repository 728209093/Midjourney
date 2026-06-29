"use client";

import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  ChevronDown,
  Download,
  ImagePlus,
  Loader2,
  RotateCcw,
  SendHorizontal,
  User,
  WandSparkles,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

import { Header } from "@/components/Header";
import { SettingsDialog } from "@/components/SettingsDialog";
import { validateApiBaseUrl } from "@/lib/api-url";
import {
  IMAGE_ASPECT_RATIO_OPTIONS,
  formatImageSize,
  getImageSizeForAspectRatio,
  inferAspectRatioFromSize,
} from "@/lib/image-size";
import { cn, copyTextToClipboard, downloadImage, getImageSrc } from "@/lib/utils";
import type {
  ImageAspectRatio,
  GenerateImageResponse,
  GeneratedImage,
  ImageApiConfig,
  ImageMode,
  ImageQuality,
  ImageResolution,
  ImageSize,
} from "@/types/image";

const HISTORY_KEY = "ai-image-studio-history";
const CHAT_STORE_KEY = "ai-image-studio-chat-store";
const API_CONFIG_KEY = "ai-image-studio-api-config";
const MAX_HISTORY_ITEMS = 20;
const DEFAULT_API_CONFIG: ImageApiConfig = {
  apiUrl: "https://dahlo.live",
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

type ChatSession = {
  id: string;
  turns: PersistedChatTurn[];
  createdAt: string;
  updatedAt: string;
};

type SettingsMessage = {
  text: string;
  tone: "success" | "error" | "info";
};




export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState<ImageAspectRatio>("1:1");
  const [resolution, setResolution] = useState<ImageResolution>("1k");
  const [quality, setQuality] = useState<ImageQuality>("medium");
  const [count, setCount] = useState(1);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [sessionId, setSessionId] = useState(() => createChatSessionId());
  const [apiConfig, setApiConfig] = useState<ImageApiConfig>(DEFAULT_API_CONFIG);
  const [referenceImage, setReferenceImage] = useState<File | null>(null);
  const [referenceImageSource, setReferenceImageSource] = useState("");
  const [referencePreviewUrl, setReferencePreviewUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [settingsMessage, setSettingsMessage] = useState<SettingsMessage | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState<GeneratedImage | null>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [referenceAction, setReferenceAction] = useState<"attach" | "replace">("attach");
  const [uploadMenuOpen, setUploadMenuOpen] = useState(false);
  const [ratioMenuOpen, setRatioMenuOpen] = useState(false);
  const [copiedTurnId, setCopiedTurnId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const uploadMenuRef = useRef<HTMLDivElement>(null);
  const ratioSelectRef = useRef<HTMLDivElement>(null);
  const size = useMemo(() => getImageSizeForAspectRatio(aspectRatio), [aspectRatio]);

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
      const rawStore = window.localStorage.getItem(CHAT_STORE_KEY);
      if (rawStore) {
        const store = JSON.parse(rawStore) as { activeSessionId?: string; sessions?: ChatSession[] };
        const sessions = Array.isArray(store?.sessions) ? store.sessions : [];
        const activeSessionId =
          typeof store?.activeSessionId === "string" ? store.activeSessionId : sessions[0]?.id;
        const activeSession = sessions.find((session) => session.id === activeSessionId) || sessions[0];

        if (activeSession) {
          setSessionId(activeSession.id);
          // 从持久化格式还原：images 为空数组（图片内容不再缓存到 localStorage）
          setTurns(
            activeSession.turns.slice(0, MAX_HISTORY_ITEMS).map((turn) => ({
              ...turn,
              images: [],
              status: "done" as const,
            })),
          );
        }
      } else {
        const rawHistory = window.localStorage.getItem(HISTORY_KEY);
        if (rawHistory) {
          const history = JSON.parse(rawHistory) as PersistedChatTurn[];
          if (Array.isArray(history)) {
            setTurns(history.slice(0, MAX_HISTORY_ITEMS).map((turn) => ({ ...turn, images: [] })));
          }
        }
      }
    } catch {
      window.localStorage.removeItem(CHAT_STORE_KEY);
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
      persistChatStore(sessionId, turns);
    }
  }, [historyLoaded, sessionId, turns]);

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

  // ESC 关闭设置弹窗
  useEffect(() => {
    if (!settingsOpen && !uploadMenuOpen && !ratioMenuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSettingsOpen(false);
        setUploadMenuOpen(false);
        setRatioMenuOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [settingsOpen, uploadMenuOpen, ratioMenuOpen]);

  // 点击菜单外部时收起菜单
  useEffect(() => {
    if (!uploadMenuOpen && !ratioMenuOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (uploadMenuOpen && uploadMenuRef.current && !uploadMenuRef.current.contains(target)) {
        setUploadMenuOpen(false);
      }
      if (ratioMenuOpen && ratioSelectRef.current && !ratioSelectRef.current.contains(target)) {
        setRatioMenuOpen(false);
      }
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [uploadMenuOpen, ratioMenuOpen]);

  const handleDownload = useCallback((image: GeneratedImage) => {
    const src = getImageSrc(image);
    if (!src) return;
    const ext = src.startsWith("data:image/png") ? "png" : src.startsWith("data:image/webp") ? "webp" : "jpg";
    downloadImage(src, `ai-image-${image.id}.${ext}`);
  }, []);

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
    const editImage =
      effectiveMode === "edit"
        ? referenceImage || (referenceImageSource ? await buildReferenceFileFromSource(referenceImageSource) : null)
        : null;

    if (effectiveMode === "edit" && !editImage) {
      setError("参考图暂时读取失败，请重新选择图片后再试。");
      return;
    }

    setLoading(true);
    setError("");
    setUploadMenuOpen(false);
    setRatioMenuOpen(false);
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
        effectiveMode === "edit" && editImage
          ? await fetch("/api/generate-image", {
              method: "POST",
              headers: { Accept: "application/json" },
              cache: "no-store",
              body: buildImageEditFormData({
                prompt: promptText,
                size,
                resolution,
                quality,
                count,
                apiConfig: apiConfigPayload,
                image: editImage,
              }),
            })
          : await fetch("/api/generate-image", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
              },
              cache: "no-store",
              body: JSON.stringify({
                prompt: promptText,
                size,
                resolution,
                quality,
                n: count,
                apiConfig: apiConfigPayload,
              }),
            });

      const data = await parseGenerateImageResponse(response);

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

  async function handleCopyTurnPrompt(turn: ChatTurn) {
    try {
      await copyTextToClipboard(turn.prompt);
      setCopiedTurnId(turn.id);
      window.setTimeout(() => setCopiedTurnId((current) => (current === turn.id ? null : current)), 1400);
    } catch {
      setError("复制失败，请稍后重试。");
    }
  }

  function handleNewChat() {
    setSessionId(createChatSessionId());
    setTurns([]);
    setPrompt("");
    setReferenceImage(null);
    setReferenceImageSource("");
    setReferencePreviewUrl("");
    setReferenceAction("attach");
    setUploadMenuOpen(false);
    setRatioMenuOpen(false);
    setError("");
    scrollToComposer();
  }

  function handleClearChat() {
    setTurns([]);
    setPrompt("");
    setReferenceImage(null);
    setReferenceImageSource("");
    setReferencePreviewUrl("");
    setReferenceAction("attach");
    setUploadMenuOpen(false);
    setRatioMenuOpen(false);
    setError("");
  }

  function scrollToComposer() {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }

  function handleReuse(image: GeneratedImage) {
    setPrompt(image.prompt);
    const reusableAspectRatio = inferAspectRatioFromSize(image.size);
    if (reusableAspectRatio) {
      setAspectRatio(reusableAspectRatio);
    }
    setResolution(image.resolution || "1k");
    setQuality(image.quality);
    scrollToComposer();
  }

  async function handleContinueEdit(image: GeneratedImage) {
    const src = getImageSrc(image);
    const file = await buildReferenceFileFromImage(image, src);
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
      setSettingsMessage(null);
      setSettingsOpen(false);
    } catch (saveError) {
      setSettingsMessage({
        text: saveError instanceof Error ? saveError.message : "API 设置保存失败。",
        tone: "error",
      });
    }
  }

  function handleResetApiConfig() {
    window.localStorage.removeItem(API_CONFIG_KEY);
    setApiConfig(DEFAULT_API_CONFIG);
    setSettingsMessage({ text: "已清除本地 API 设置。", tone: "info" });
    window.setTimeout(() => setSettingsMessage(null), 1600);
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
    <main className="flex min-h-[100dvh] flex-col overflow-x-hidden overflow-y-auto lg:h-screen lg:overflow-hidden">
      <Header
        onOpenSettings={() => setSettingsOpen(true)}
        onNewChat={handleNewChat}
        onClearChat={handleClearChat}
      />
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
          aspectRatio={aspectRatio}
          size={size}
          resolution={resolution}
          count={count}
          loading={loading}
          onAspectRatioChange={setAspectRatio}
          onResolutionChange={setResolution}
          onCountChange={setCount}
        />
      </SettingsDialog>

      <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col px-3 py-3 sm:px-6 sm:py-4">
        <section
          id="history"
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
                  <div className="mt-2 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopyTurnPrompt(turn)}
                      className="text-xs text-ink/70 transition hover:text-ink"
                    >
                      {copiedTurnId === turn.id ? "已复制" : "复制文字"}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Avatar icon={<Bot className="size-4" aria-hidden />} />
                <div
                  className={cn(
                    "min-w-0 max-w-[min(56rem,86vw)] rounded-2xl rounded-tl-md border border-white/10 bg-ink/70 p-3",
                    turn.status === "loading" ? "w-fit" : "flex-1",
                  )}
                >
                  {turn.status === "loading" ? <LoadingBubble count={count} /> : null}
                  {turn.status === "error" ? <p className="text-sm leading-6 text-rose-200">{turn.error}</p> : null}
                  {turn.status === "done" ? (
                    <div className="space-y-3">
                      <p className="text-xs text-stone-400">
                        已生成 {turn.images.length > 0 ? turn.images.length : (turn as unknown as { imageCount?: number }).imageCount ?? 0} 张图片
                      </p>
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {turn.images.map((image) => (
                          <GeneratedImageCard
                            key={image.id}
                            image={image}
                            onPreview={setPreviewImage}
                            onContinueEdit={handleContinueEdit}
                            onReuse={handleReuse}
                            onDownload={handleDownload}
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
            {error ? (
              <div className="rounded-md border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
                {error}
              </div>
            ) : null}

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

            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1 space-y-3">
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
                  className="min-h-[92px] w-full resize-none rounded-md border border-white/10 bg-ink/70 px-3 py-3 text-sm leading-6 text-white placeholder:text-stone-500 transition focus:border-mint disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-[56px]"
                />

                <div className="flex flex-wrap items-center gap-2 text-xs text-stone-400">
                  <span className="shrink-0">画幅</span>
                  <div className="relative" ref={ratioSelectRef}>
                    <button
                      type="button"
                      onClick={() => setRatioMenuOpen((current) => !current)}
                      disabled={loading}
                      className="inline-flex h-9 min-w-24 items-center justify-between gap-2 rounded-md border border-white/10 bg-white/[0.04] px-3 text-xs text-stone-200 transition hover:border-mint/50 hover:text-mint disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <span>{aspectRatio}</span>
                      <ChevronDown className="size-3.5 opacity-70" aria-hidden />
                    </button>

                    {ratioMenuOpen ? (
                      <div className="absolute left-0 top-full z-20 mt-2 w-44 overflow-hidden rounded-md border border-white/10 bg-ink/98 shadow-soft">
                        {IMAGE_ASPECT_RATIO_OPTIONS.map((option) => (
                          <button
                            key={option.ratio}
                            type="button"
                            onClick={() => {
                              setAspectRatio(option.ratio);
                              setRatioMenuOpen(false);
                            }}
                            disabled={loading}
                            className={cn(
                              "flex w-full items-center justify-between px-3 py-2 text-left text-sm transition hover:bg-white/[0.05]",
                              aspectRatio === option.ratio ? "text-mint" : "text-stone-200",
                            )}
                          >
                            <span>{option.ratio}</span>
                            <span className="text-xs text-stone-500">{formatImageSize(option.size)}</span>
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="relative shrink-0 self-end sm:self-auto" ref={uploadMenuRef}>
                <button
                  type="button"
                  onClick={() => setUploadMenuOpen((current) => !current)}
                  disabled={loading}
                  className={cn(
                    "inline-flex h-12 w-12 items-center justify-center rounded-md border transition sm:h-14 sm:w-14",
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

                {uploadMenuOpen ? (
                  <div className="absolute bottom-full right-0 mb-2 w-36 overflow-hidden rounded-md border border-white/10 bg-ink/95 shadow-soft">
                    <button
                      type="button"
                      onClick={() => {
                        setUploadMenuOpen(false);
                        imageInputRef.current?.click();
                      }}
                      className="block w-full px-3 py-2 text-left text-sm text-stone-200 transition hover:bg-white/[0.05]"
                    >
                      从相册选择
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setUploadMenuOpen(false);
                        cameraInputRef.current?.click();
                      }}
                      className="block w-full px-3 py-2 text-left text-sm text-stone-200 transition hover:bg-white/[0.05]"
                    >
                      直接拍照
                    </button>
                  </div>
                ) : null}
              </div>
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
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
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
                className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-mint text-ink transition hover:bg-teal-200 disabled:cursor-not-allowed disabled:bg-stone-600 disabled:text-stone-300 sm:h-14 sm:w-14"
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
              <button type="button" onClick={() => setSettingsOpen(true)} className="transition hover:text-mint">
                参数设置
              </button>
            </div>
          </form>
        </section>
      </div>

      {showScrollButton ? (
        <button
          type="button"
          onClick={() => bottomRef.current?.scrollIntoView({ behavior: "smooth" })}
          className="fixed bottom-28 right-4 z-30 hidden items-center gap-2 rounded-full border border-white/10 bg-ink/90 px-4 py-2 text-sm text-white shadow-soft backdrop-blur sm:inline-flex"
        >
          <ChevronDown className="size-4" aria-hidden />
          回到底部
        </button>
      ) : null}

      <ImagePreviewDialog
        image={previewImage}
        onClose={() => setPreviewImage(null)}
        onDownload={handleDownload}
      />
    </main>
  );
}

function ParameterSettings({
  aspectRatio,
  size,
  resolution,
  count,
  loading,
  onAspectRatioChange,
  onResolutionChange,
  onCountChange,
}: {
  aspectRatio: ImageAspectRatio;
  size: ImageSize;
  resolution: ImageResolution;
  count: number;
  loading: boolean;
  onAspectRatioChange: (value: ImageAspectRatio) => void;
  onResolutionChange: (value: ImageResolution) => void;
  onCountChange: (value: number) => void;
}) {
  return (
    <section className="rounded-lg border border-white/10 bg-panel/94 p-4 shadow-soft">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-white">生成参数</h2>
          <p className="mt-1 text-xs text-stone-400">影响下一次发送的图片结果</p>
        </div>
        <p className="text-xs text-stone-400">
          当前尺寸 <span className="text-white">{formatImageSize(size)}</span>
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-stone-400">
            <span>画幅比例</span>
            <span className="text-white">{aspectRatio}</span>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {IMAGE_ASPECT_RATIO_OPTIONS.map((item) => (
              <button
                key={item.ratio}
                type="button"
                onClick={() => onAspectRatioChange(item.ratio)}
                disabled={loading}
                className={cn(
                  "rounded-md border px-2 py-2 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-60",
                  aspectRatio === item.ratio
                    ? "border-mint bg-mint text-ink"
                    : "border-white/10 bg-white/[0.03] text-stone-300 hover:border-mint/50",
                )}
              >
                <span className="block font-medium">{item.label}</span>
                <span
                  className={cn(
                    "mt-1 block text-[11px]",
                    aspectRatio === item.ratio ? "text-ink/75" : "text-stone-500",
                  )}
                >
                  {formatImageSize(item.size)}
                </span>
              </button>
            ))}
          </div>
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
    <div className="space-y-3" aria-live="polite" aria-busy="true">
      <div className="flex items-center gap-2 text-sm font-medium text-white">
        <Loader2 className="size-4 animate-spin text-mint" aria-hidden />
        <span>正在生成图片</span>
      </div>

      <div className="flex flex-wrap gap-3">
        {Array.from({ length: count }).map((_, index) => (
          <div
            key={index}
            className="relative size-[min(16rem,68vw)] shrink-0 overflow-hidden rounded-lg border border-white/10 bg-white/[0.04] sm:size-60"
          >
            <div className="absolute inset-0 bg-[linear-gradient(115deg,transparent_0%,rgba(255,255,255,0.04)_32%,rgba(94,234,212,0.18)_48%,rgba(255,255,255,0.05)_64%,transparent_100%)] animate-[image-loading-shine_1.7s_ease-in-out_infinite]" />
            <div className="absolute inset-4 rounded-md border border-white/10 bg-ink/[0.45]" />
            <div className="absolute bottom-4 left-4 right-4 space-y-2">
              <div className="h-2 rounded-full bg-white/15" />
              <div className="h-2 w-2/3 rounded-full bg-white/10" />
            </div>
            <div className="absolute right-4 top-4 grid size-8 place-items-center rounded-full border border-mint/25 bg-mint/10 text-mint">
              <WandSparkles className="size-4" aria-hidden />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function GeneratedImageCard({
  image,
  onPreview,
  onContinueEdit,
  onReuse,
  onDownload,
}: {
  image: GeneratedImage;
  onPreview: (image: GeneratedImage) => void;
  onContinueEdit: (image: GeneratedImage) => void;
  onReuse: (image: GeneratedImage) => void;
  onDownload: (image: GeneratedImage) => void;
}) {
  const src = getImageSrc(image);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);

  return (
    <div className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.03]">
      <button
        type="button"
        onClick={() => onPreview(image)}
        className="relative block w-full text-left transition hover:bg-white/[0.04]"
        title="预览大图"
      >
        {/* 加载占位骨架 */}
        {!imgLoaded && !imgError ? (
          <div className="aspect-square w-full animate-pulse rounded-t-lg bg-white/[0.06]" />
        ) : null}
        {imgError ? (
          <div className="grid aspect-square w-full place-items-center rounded-t-lg bg-white/[0.04] text-xs text-stone-500">
            图片加载失败
          </div>
        ) : null}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={image.prompt}
          className={cn(
            "aspect-square w-full object-cover transition-opacity duration-300",
            imgLoaded ? "opacity-100" : "absolute inset-0 opacity-0",
          )}
          onLoad={() => setImgLoaded(true)}
          onError={() => { setImgLoaded(true); setImgError(true); }}
        />
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
            title="复用参数"
          >
            <RotateCcw className="size-3.5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => onDownload(image)}
            disabled={!src}
            className="inline-flex items-center justify-center gap-1 rounded-md border border-white/10 px-2 py-1.5 text-xs text-stone-300 transition hover:border-mint/50 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            title="下载图片"
          >
            <Download className="size-3.5" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}

function ImagePreviewDialog({
  image,
  onClose,
  onDownload,
}: {
  image: GeneratedImage | null;
  onClose: () => void;
  onDownload: (image: GeneratedImage) => void;
}) {
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    if (!image) {
      return;
    }

    setZoom(1);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
      if ((event.key === "+" || event.key === "=") && !event.metaKey && !event.ctrlKey) {
        setZoom((current) => Math.min(3, Number((current + 0.25).toFixed(2))));
      }
      if (event.key === "-" && !event.metaKey && !event.ctrlKey) {
        setZoom((current) => Math.max(0.5, Number((current - 0.25).toFixed(2))));
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [image, onClose]);

  if (!image) {
    return null;
  }

  const src = getImageSrc(image);
  const canZoomOut = zoom > 0.5;
  const canZoomIn = zoom < 3;

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-black/[0.92] backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="图片预览"
      onClick={onClose}
    >
      <div
        className="flex items-center justify-between gap-3 border-b border-white/10 bg-ink/[0.85] px-3 py-3 sm:px-4"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="min-w-0 flex-1 truncate text-sm text-stone-300">{image.prompt}</p>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setZoom((current) => Math.max(0.5, Number((current - 0.25).toFixed(2))))}
            disabled={!canZoomOut}
            className="grid size-10 place-items-center rounded-md border border-white/10 bg-white/[0.04] text-stone-200 transition hover:border-mint/50 hover:text-mint disabled:cursor-not-allowed disabled:opacity-40"
            title="缩小"
          >
            <ZoomOut className="size-4" aria-hidden />
            <span className="sr-only">缩小</span>
          </button>
          <button
            type="button"
            onClick={() => setZoom(1)}
            className="h-10 min-w-14 rounded-md border border-white/10 bg-white/[0.04] px-2 text-xs font-medium text-stone-200 transition hover:border-mint/50 hover:text-mint"
            title="重置缩放"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            onClick={() => setZoom((current) => Math.min(3, Number((current + 0.25).toFixed(2))))}
            disabled={!canZoomIn}
            className="grid size-10 place-items-center rounded-md border border-white/10 bg-white/[0.04] text-stone-200 transition hover:border-mint/50 hover:text-mint disabled:cursor-not-allowed disabled:opacity-40"
            title="放大"
          >
            <ZoomIn className="size-4" aria-hidden />
            <span className="sr-only">放大</span>
          </button>
          <button
            type="button"
            onClick={() => onDownload(image)}
            disabled={!src}
            className="grid size-10 place-items-center rounded-md border border-white/10 bg-white/[0.04] text-stone-200 transition hover:border-mint/50 hover:text-mint disabled:cursor-not-allowed disabled:opacity-40"
            title="保存图片"
          >
            <Download className="size-4" aria-hidden />
            <span className="sr-only">保存图片</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="grid size-10 place-items-center rounded-md border border-white/10 bg-white/[0.04] text-stone-200 transition hover:border-coral/60 hover:text-coral"
            title="关闭"
          >
            <X className="size-4" aria-hidden />
            <span className="sr-only">关闭</span>
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-3 sm:p-6" onClick={(event) => event.stopPropagation()}>
        <div className="grid min-h-full place-items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={image.prompt}
            className="max-h-[calc(100vh-7rem)] max-w-full rounded-md object-contain shadow-soft transition-transform duration-150"
            style={{ transform: `scale(${zoom})` }}
          />
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

function persistChatStore(activeSessionId: string, turns: ChatTurn[]) {
  // 只持久化元数据，不存储 base64/url 内容，避免撑爆 localStorage quota
  const persistedTurns: PersistedChatTurn[] = turns.slice(0, MAX_HISTORY_ITEMS).map(({ images, ...rest }) => ({
    ...rest,
    imageCount: images.length,
  }));

  const nextSession: ChatSession = {
    id: activeSessionId,
    turns: persistedTurns,
    createdAt: turns[0]?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  try {
    const rawStore = window.localStorage.getItem(CHAT_STORE_KEY);
    const currentStore = rawStore ? (JSON.parse(rawStore) as { activeSessionId?: string; sessions?: ChatSession[] }) : {};
    const sessions = Array.isArray(currentStore.sessions) ? currentStore.sessions : [];
    const nextSessions = sessions.filter((session) => session.id !== activeSessionId);
    nextSessions.unshift(nextSession);

    window.localStorage.setItem(
      CHAT_STORE_KEY,
      JSON.stringify({
        activeSessionId,
        sessions: nextSessions.slice(0, 20),
      }),
    );
  } catch (error) {
    if (!isStorageQuotaError(error)) {
      return;
    }

    window.localStorage.removeItem(CHAT_STORE_KEY);
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

function createChatSessionId() {
  return `chat_${Date.now()}_${Math.random().toString(16).slice(2)}`;
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
    const response = await fetch(`/api/image-proxy?url=${encodeURIComponent(src)}`);
    if (!response.ok) {
      return null;
    }

    const blob = await response.blob();
    return new File([blob], fileName, { type: blob.type || "image/png" });
  } catch {
    return null;
  }
}

async function buildReferenceFileFromSource(src: string) {
  if (!src) {
    return null;
  }

  try {
    const response = await fetch(`/api/image-proxy?url=${encodeURIComponent(src)}`);
    if (!response.ok) {
      return null;
    }

    const blob = await response.blob();
    return new File([blob], "reference.png", { type: blob.type || "image/png" });
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

async function parseGenerateImageResponse(response: Response): Promise<GenerateImageResponse> {
  const contentType = response.headers.get("content-type") || "";
  const raw = await response.text();
  const trimmed = raw.trim();

  if (!trimmed) {
    throw new Error(`接口未返回内容，状态码 ${response.status}。`);
  }

  if (!contentType.includes("application/json")) {
    const snippet = trimmed.replace(/\s+/g, " ").slice(0, 160);
    throw new Error(
      snippet.startsWith("<")
        ? `服务端返回了 HTML 页面，状态码 ${response.status}，请稍后重试。`
        : `服务端返回了非 JSON 内容：${snippet}`,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed) as unknown;
  } catch {
    throw new Error(`接口返回了无法解析的 JSON，状态码 ${response.status}。`);
  }

  if (!parsed || typeof parsed !== "object" || !("success" in parsed)) {
    throw new Error(`接口响应格式异常，状态码 ${response.status}。`);
  }

  return parsed as GenerateImageResponse;
}
