"use client";

import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  ChevronDown,
  Download,
  ImagePlus,
  Loader2,
  PencilLine,
  Pin,
  PinOff,
  Plus,
  RotateCcw,
  SendHorizontal,
  Trash2,
  User,
  WandSparkles,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

import { Header } from "@/components/Header";
import { SettingsDialog } from "@/components/SettingsDialog";
import { validateApiBaseUrl } from "@/lib/api-url";
import { deleteImagesFromHistory, getImagesFromHistory, saveImagesToHistory } from "@/lib/image-history-db";
import { parseImageSize } from "@/lib/image-size";
import { cn, copyTextToClipboard, downloadImage, getImageSrc } from "@/lib/utils";
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
const CHAT_STORE_KEY = "ai-image-studio-chat-store";
const API_CONFIG_KEY = "ai-image-studio-api-config";
const MAX_HISTORY_ITEMS = 20;
const MAX_SESSION_ITEMS = 20;
const DEFAULT_API_CONFIG: ImageApiConfig = {
  apiUrl: "https://dahlo.live",
  apiKey: "",
  model: "gpt-image-2",
};

const ASPECT_OPTIONS: Array<{ label: string; size: ImageSize; detail: string }> = [
  { label: "1:1", size: "1024x1024", detail: "1024 x 1024" },
  { label: "16:9", size: "1536x864", detail: "1536 x 864" },
  { label: "9:16", size: "864x1536", detail: "864 x 1536" },
  { label: "3:2", size: "1536x1024", detail: "1536 x 1024" },
  { label: "2:3", size: "1024x1536", detail: "1024 x 1536" },
  { label: "4:3", size: "1408x1056", detail: "1408 x 1056" },
  { label: "3:4", size: "1056x1408", detail: "1056 x 1408" },
  { label: "21:9", size: "1536x656", detail: "1536 x 656" },
];

const RESOLUTION_OPTIONS: ImageResolution[] = ["1k", "2k", "4k"];
const COUNT_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const QUALITY_OPTIONS: Array<{ value: ImageQuality; label: string }> = [
  { value: "low", label: "低" },
  { value: "medium", label: "中" },
  { value: "high", label: "高" },
];

type ChatDraft = {
  prompt: string;
  size: ImageSize;
  resolution: ImageResolution;
  quality: ImageQuality;
  count: number;
  referenceImageSource: string;
  referenceImageMeta: { name?: string; type?: string } | null;
};

type ChatTurn = {
  id: string;
  prompt: string;
  images: GeneratedImage[];
  imageIds?: string[];
  mode: ImageMode;
  size: ImageSize;
  resolution: ImageResolution;
  quality: ImageQuality;
  count?: number;
  createdAt: string;
  status: "done" | "loading" | "error";
  error?: string;
  imageCount?: number;
};

type PersistedChatTurn = Omit<ChatTurn, "images" | "imageCount"> & {
  imageCount: number;
};

type ChatSession = {
  id: string;
  title: string;
  pinned: boolean;
  turns: ChatTurn[];
  draft: ChatDraft;
  createdAt: string;
  updatedAt: string;
  titleEdited?: boolean;
};

type PersistedChatSession = Omit<ChatSession, "turns"> & {
  turns: PersistedChatTurn[];
};

type SessionStore = {
  activeSessionId: string;
  sessions: PersistedChatSession[];
};

type SettingsMessage = {
  text: string;
  tone: "success" | "error" | "info";
};

const DEFAULT_DRAFT: ChatDraft = {
  prompt: "",
  size: "1024x1024",
  resolution: "1k",
  quality: "medium",
  count: 1,
  referenceImageSource: "",
  referenceImageMeta: null,
};

export default function Home() {
  const [sessions, setSessions] = useState<ChatSession[]>(() => [createBlankSession()]);
  const [activeSessionId, setActiveSessionId] = useState(() => createChatSessionId());
  const [apiConfig, setApiConfig] = useState<ImageApiConfig>(DEFAULT_API_CONFIG);
  const [error, setError] = useState("");
  const [settingsMessage, setSettingsMessage] = useState<SettingsMessage | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState<GeneratedImage | null>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [copiedTurnId, setCopiedTurnId] = useState<string | null>(null);
  const [uploadMenuOpen, setUploadMenuOpen] = useState(false);
  const [aspectPanelOpen, setAspectPanelOpen] = useState(false);
  const [countPanelOpen, setCountPanelOpen] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [referenceDragging, setReferenceDragging] = useState(false);
  const [pendingDeleteTurnId, setPendingDeleteTurnId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const uploadMenuRef = useRef<HTMLDivElement>(null);
  const aspectPanelRef = useRef<HTMLDivElement>(null);
  const countPanelRef = useRef<HTMLDivElement>(null);
  const activeSessionIdRef = useRef(activeSessionId);

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId) || sessions[0] || createBlankSession(),
    [sessions, activeSessionId],
  );
  const activeSessionGenerating = hasLoadingTurn(activeSession);

  const sortedSessions = useMemo(() => {
    return [...sessions].sort((left, right) => {
      if (left.pinned !== right.pinned) {
        return Number(right.pinned) - Number(left.pinned);
      }

      return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
    });
  }, [sessions]);

  const canGenerate = useMemo(
    () => activeSession.draft.prompt.trim().length > 0 && !activeSessionGenerating,
    [activeSession.draft.prompt, activeSessionGenerating],
  );

  const selectedAspectOption = useMemo(
    () => ASPECT_OPTIONS.find((option) => option.size === activeSession.draft.size) || ASPECT_OPTIONS[0],
    [activeSession.draft.size],
  );
  const referencePreviewUrl = activeSession.draft.referenceImageSource;
  useEffect(() => {
    activeSessionIdRef.current = activeSessionId;
  }, [activeSessionId]);

  useEffect(() => {
    let cancelled = false;

    async function loadLocalState() {
      try {
        const rawStore = window.localStorage.getItem(CHAT_STORE_KEY);
        if (rawStore) {
          const parsed = JSON.parse(rawStore) as Partial<SessionStore> | null;
          const loadedSessions = Array.isArray(parsed?.sessions)
            ? parsed.sessions.map((session) => normalizeSession(session))
            : [];
          const activeId = typeof parsed?.activeSessionId === "string" ? parsed.activeSessionId : loadedSessions[0]?.id;

          if (loadedSessions.length > 0) {
            const hydratedSessions = await hydrateSessions(loadedSessions.slice(0, MAX_SESSION_ITEMS));
            if (cancelled) return;

            setSessions(hydratedSessions);
            setActiveSessionId(activeId && hydratedSessions.some((session) => session.id === activeId) ? activeId : hydratedSessions[0].id);
          } else {
            throw new Error("Empty session store");
          }
        } else {
          const rawHistory = window.localStorage.getItem(HISTORY_KEY);
          if (rawHistory) {
            const history = JSON.parse(rawHistory) as PersistedChatTurn[];
            if (Array.isArray(history) && history.length > 0) {
              const hydratedTurns = await hydratePersistedTurns(history.slice(0, MAX_HISTORY_ITEMS));
              if (cancelled) return;

              const createdAt = hydratedTurns[0]?.createdAt || new Date().toISOString();
              const title = deriveTitleFromPrompt(hydratedTurns[0]?.prompt || "");
              const session = createBlankSession();
              session.createdAt = createdAt;
              session.updatedAt = hydratedTurns[hydratedTurns.length - 1]?.createdAt || createdAt;
              session.title = title || session.title;
              session.turns = hydratedTurns;

              setSessions([session]);
              setActiveSessionId(session.id);
            }
          }
        }
      } catch {
        window.localStorage.removeItem(CHAT_STORE_KEY);
        window.localStorage.removeItem(HISTORY_KEY);
      }

      try {
        const rawConfig = window.localStorage.getItem(API_CONFIG_KEY);
        if (rawConfig && !cancelled) {
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

      if (!cancelled) {
        setHistoryLoaded(true);
      }
    }

    void loadLocalState();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (historyLoaded) {
      persistChatStore(activeSessionId, sessions);
    }
  }, [historyLoaded, activeSessionId, sessions]);

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
  }, [activeSessionId, sessions]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [activeSession.turns, activeSessionId]);

  useEffect(() => {
    if (!settingsOpen && !uploadMenuOpen && !aspectPanelOpen && !countPanelOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSettingsOpen(false);
        setUploadMenuOpen(false);
        setAspectPanelOpen(false);
        setCountPanelOpen(false);
        setEditingSessionId(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [settingsOpen, uploadMenuOpen, aspectPanelOpen, countPanelOpen]);

  useEffect(() => {
    if (!pendingDeleteTurnId) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPendingDeleteTurnId(null);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pendingDeleteTurnId]);

  useEffect(() => {
    if (!uploadMenuOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (uploadMenuRef.current && !uploadMenuRef.current.contains(target)) {
        setUploadMenuOpen(false);
      }
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [uploadMenuOpen]);

  useEffect(() => {
    if (!aspectPanelOpen && !countPanelOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (aspectPanelOpen && aspectPanelRef.current && !aspectPanelRef.current.contains(target)) {
        setAspectPanelOpen(false);
      }
      if (countPanelOpen && countPanelRef.current && !countPanelRef.current.contains(target)) {
        setCountPanelOpen(false);
      }
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [aspectPanelOpen, countPanelOpen]);

  const handleDownload = useCallback((image: GeneratedImage) => {
    const src = getImageSrc(image);
    if (!src) return;
    const ext = src.startsWith("data:image/png") ? "png" : src.startsWith("data:image/webp") ? "webp" : "jpg";
    downloadImage(src, `ai-image-${image.id}.${ext}`);
  }, []);

  const updateActiveSession = useCallback(
    (updater: (session: ChatSession) => ChatSession) => {
      setSessions((current) => current.map((session) => (session.id === activeSessionId ? updater(session) : session)));
    },
    [activeSessionId],
  );

  const updateSessionById = useCallback((sessionId: string, updater: (session: ChatSession) => ChatSession) => {
    setSessions((current) => current.map((session) => (session.id === sessionId ? updater(session) : session)));
  }, []);

  async function handleGenerate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const promptText = activeSession.draft.prompt.trim();
    if (!promptText) {
      setError("请先输入提示词。");
      return;
    }

    if (activeSessionGenerating) {
      setError("当前聊天正在生图，请稍后再发起新的生成。");
      return;
    }

    const currentSession = activeSession;
    const generationSessionId = currentSession.id;
    const turnId = createChatTurnId();
    const createdAt = new Date().toISOString();
    const effectiveMode: ImageMode = currentSession.draft.referenceImageSource ? "edit" : "generate";
    const referenceImageFile =
      effectiveMode === "edit" ? await buildReferenceFileFromSource(currentSession.draft.referenceImageSource) : null;

    if (effectiveMode === "edit" && !referenceImageFile) {
      setError("参考图暂时读取失败，请重新选择/上传参考图后再试。");
      return;
    }

    setError("");
    setUploadMenuOpen(false);

    updateSessionById(generationSessionId, (session) => ({
      ...session,
      updatedAt: createdAt,
      title: session.titleEdited ? session.title : session.title || deriveTitleFromPrompt(promptText),
      turns: [
        ...session.turns,
        {
          id: turnId,
          prompt: promptText,
          images: [],
          mode: effectiveMode,
          size: session.draft.size,
          resolution: session.draft.resolution,
          quality: session.draft.quality,
          count: session.draft.count,
          createdAt,
          status: "loading",
        },
      ],
      draft: {
        ...session.draft,
        prompt: promptText,
      },
    }));

    try {
      const apiConfigPayload = normalizeApiConfig(apiConfig);
      const response =
        effectiveMode === "edit"
          ? await fetch("/api/generate-image", {
              method: "POST",
              headers: { Accept: "application/json" },
              cache: "no-store",
              body: buildImageEditFormData({
                prompt: promptText,
                size: currentSession.draft.size,
                resolution: currentSession.draft.resolution,
                quality: currentSession.draft.quality,
                count: currentSession.draft.count,
                apiConfig: apiConfigPayload,
                image: referenceImageFile,
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
                size: currentSession.draft.size,
                resolution: currentSession.draft.resolution,
                quality: currentSession.draft.quality,
                n: currentSession.draft.count,
                apiConfig: apiConfigPayload,
              }),
            });

      const data = await parseGenerateImageResponse(response);
      if (!data.success) {
        throw new Error(data.message);
      }

      try {
        await saveImagesToHistory(data.images);
      } catch (storageError) {
        console.warn("[image-history] failed to save generated images", storageError);
      }

      updateSessionById(generationSessionId, (session) => {
        const nextTitle = session.titleEdited ? session.title : deriveTitleFromPrompt(promptText) || session.title;
        return {
          ...session,
          title: nextTitle,
          updatedAt: new Date().toISOString(),
          turns: session.turns.map((turn) =>
            turn.id === turnId
              ? { ...turn, images: data.images, imageIds: data.images.map((image) => image.id), status: "done" }
              : turn,
          ),
        };
      });

      updateSessionById(generationSessionId, (session) => ({
        ...session,
        draft: {
          ...session.draft,
          prompt: "",
        },
      }));
    } catch (requestError) {
      const message = getFriendlyGenerateErrorMessage(requestError);
      updateSessionById(generationSessionId, (session) => ({
        ...session,
        updatedAt: new Date().toISOString(),
        turns: session.turns.map((turn) => (turn.id === turnId ? { ...turn, status: "error", error: message } : turn)),
      }));
      if (activeSessionIdRef.current === generationSessionId) {
        setError(message);
      }
    }
  }

  function handleDeleteTurn(id: string) {
    const target = activeSession.turns.find((turn) => turn.id === id);
    if (target?.status === "loading") {
      setError("这一轮正在生图，完成后再删除。");
      return;
    }

    setPendingDeleteTurnId(id);
  }

  function confirmDeleteTurn() {
    const id = pendingDeleteTurnId;
    if (!id) return;

    const target = activeSession.turns.find((turn) => turn.id === id);
    if (target) {
      void deleteImagesFromHistory(getImageIdsFromTurn(target)).catch((storageError) => {
        console.warn("[image-history] failed to delete turn images", storageError);
      });
    }

    updateActiveSession((session) => ({
      ...session,
      updatedAt: new Date().toISOString(),
      turns: session.turns.filter((turn) => turn.id !== id),
    }));
    setPendingDeleteTurnId(null);
  }

  function closeDeleteTurnDialog() {
    setPendingDeleteTurnId(null);
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
    const nextSession = createBlankSession();
    setSessions((current) => [nextSession, ...current.filter((session) => session.id !== nextSession.id)].slice(0, MAX_SESSION_ITEMS));
    setActiveSessionId(nextSession.id);
    setEditingSessionId(null);
    setError("");
    scrollToComposer();
  }

  function handleClearChat() {
    if (activeSessionGenerating) {
      setError("当前聊天正在生图，完成后再清空。");
      return;
    }

    void deleteImagesFromHistory(getImageIdsFromTurns(activeSession.turns)).catch((storageError) => {
      console.warn("[image-history] failed to clear chat images", storageError);
    });

    updateActiveSession((session) => ({
      ...session,
      title: "新聊天",
      titleEdited: false,
      pinned: false,
      turns: [],
      draft: { ...DEFAULT_DRAFT },
      updatedAt: new Date().toISOString(),
    }));
    setEditingSessionId(null);
    setError("");
  }

  function handleSwitchSession(sessionId: string) {
    setActiveSessionId(sessionId);
    setEditingSessionId(null);
    setError("");
  }

  function handleTogglePin(sessionId: string) {
    setSessions((current) =>
      current.map((session) =>
        session.id === sessionId ? { ...session, pinned: !session.pinned, updatedAt: new Date().toISOString() } : session,
      ),
    );
  }

  function handleDeleteSession(sessionId: string) {
    const target = sessions.find((session) => session.id === sessionId);
    if (target && hasLoadingTurn(target)) {
      if (sessionId === activeSessionId) {
        setError("这个聊天正在生图，完成后再删除。");
      }
      return;
    }

    if (target) {
      void deleteImagesFromHistory(getImageIdsFromTurnsFromSession(target)).catch((storageError) => {
        console.warn("[image-history] failed to delete session images", storageError);
      });
    }

    setSessions((current) => {
      const remaining = current.filter((session) => session.id !== sessionId);
      if (remaining.length === 0) {
        const next = createBlankSession();
        setActiveSessionId(next.id);
        return [next];
      }

      if (sessionId === activeSessionId) {
        setActiveSessionId(remaining[0].id);
      }

      return remaining;
    });
  }

  function beginRenameSession(session: ChatSession) {
    setEditingSessionId(session.id);
    setEditingTitle(session.title);
  }

  function commitRenameSession(sessionId: string, nextTitle: string) {
    const title = nextTitle.trim() || "新聊天";
    setSessions((current) =>
      current.map((session) =>
        session.id === sessionId ? { ...session, title, titleEdited: true, updatedAt: new Date().toISOString() } : session,
      ),
    );
    setEditingSessionId(null);
  }

  function scrollToComposer() {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }

  function handleReuse(image: GeneratedImage) {
    updateActiveSession((session) => ({
      ...session,
      draft: {
        ...session.draft,
        prompt: image.prompt,
        size: image.size || "1024x1024",
        resolution: image.resolution || "1k",
        quality: image.quality,
      },
      updatedAt: new Date().toISOString(),
    }));
    scrollToComposer();
  }

  async function handleContinueEdit(image: GeneratedImage) {
    const src = getImageSrc(image);
    if (!src) {
      setError("这张图片暂时没有可用的参考图地址，请换一张图片再试。");
      return;
    }

    let referenceImageSource = src;
    let referenceImageMeta: ChatDraft["referenceImageMeta"] = { name: `reference-${image.id}.png`, type: "image/png" };
    if (!src.startsWith("data:")) {
      const file = await buildReferenceFileFromSource(src);
      if (!file) {
        setError("这张图片暂时无法作为参考图读取，请下载后重新上传，或换一张图片再试。");
        return;
      }
      referenceImageSource = await readFileAsDataUrl(file);
      referenceImageMeta = { name: file.name, type: file.type };
    }

    updateActiveSession((session) => ({
      ...session,
      draft: {
        ...session.draft,
        prompt: "",
        size: image.size || "1024x1024",
        resolution: image.resolution || "1k",
        quality: image.quality,
        referenceImageSource,
        referenceImageMeta,
      },
      updatedAt: new Date().toISOString(),
    }));
    setError("");
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

  function setActiveSessionDraft(updater: (draft: ChatDraft) => ChatDraft) {
    updateActiveSession((session) => ({
      ...session,
      draft: updater(session.draft),
      updatedAt: new Date().toISOString(),
    }));
  }

  function handleReferenceImageFiles(file: File | null) {
    if (!file) {
      setActiveSessionDraft((draft) => ({
        ...draft,
        referenceImageSource: "",
        referenceImageMeta: null,
      }));
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError("请选择图片文件。");
      return;
    }

    void (async () => {
      const dataUrl = await readFileAsDataUrl(file);
      setActiveSessionDraft((draft) => ({
        ...draft,
        referenceImageSource: dataUrl,
        referenceImageMeta: { name: file.name, type: file.type },
      }));
      setError("");
    })().catch(() => {
      setError("参考图读取失败，请重试。");
    });
  }

  function handleDropReference(event: React.DragEvent<HTMLElement>) {
    event.preventDefault();
    setReferenceDragging(false);
    if (activeSessionGenerating) return;
    const file = getFirstImageFileFromDataTransfer(event.dataTransfer);
    handleReferenceImageFiles(file);
  }

  function handlePasteReference(event: React.ClipboardEvent<HTMLTextAreaElement>) {
    if (activeSessionGenerating) return;

    const file = getFirstImageFileFromDataTransfer(event.clipboardData);
    if (!file) {
      return;
    }

    event.preventDefault();
    handleReferenceImageFiles(file);
  }

  return (
    <main className="flex min-h-[100dvh] flex-col overflow-x-hidden overflow-y-auto lg:h-screen lg:overflow-hidden">
      <Header onOpenSettings={() => setSettingsOpen(true)} onNewChat={handleNewChat} onClearChat={handleClearChat} />

      <SettingsDialog
        open={settingsOpen}
        apiConfig={apiConfig}
        message={settingsMessage}
        disabled={activeSessionGenerating}
        onApiConfigChange={setApiConfig}
        onSave={handleSaveApiConfig}
        onReset={handleResetApiConfig}
        onClose={() => setSettingsOpen(false)}
      />

      <div className="mx-auto flex min-h-0 w-full max-w-[1840px] flex-1 flex-col gap-4 px-4 pb-4 pt-20 sm:px-6 xl:px-8 lg:flex-row">
        <aside className="min-h-0 w-full shrink-0 overflow-hidden rounded-lg border border-white/10 bg-panel/55 shadow-soft lg:w-80 xl:w-84">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-white">聊天分组</h2>
              <p className="mt-1 text-xs text-stone-400">{sortedSessions.length} 个会话</p>
            </div>
            <button
              type="button"
              onClick={handleNewChat}
              className="inline-flex size-9 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-stone-200 transition hover:border-mint/50 hover:text-mint disabled:cursor-not-allowed disabled:opacity-60"
              title="新建聊天"
            >
              <Plus className="size-4" aria-hidden />
              <span className="sr-only">新建聊天</span>
            </button>
          </div>

          <div className="max-h-[32rem] overflow-y-auto p-2 lg:h-[calc(100dvh-8rem)] lg:max-h-none">
            <div className="space-y-2">
              {sortedSessions.map((session) => {
                const active = session.id === activeSessionId;
                const editing = editingSessionId === session.id;
                const sessionGenerating = hasLoadingTurn(session);
                const sessionFailed = hasErrorTurn(session);
                return (
                  <div
                    key={session.id}
                    className={cn(
                      "rounded-md border p-2 transition",
                      active ? "border-mint/50 bg-mint/[0.08]" : "border-white/10 bg-white/[0.03]",
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <button
                        type="button"
                        onClick={() => handleSwitchSession(session.id)}
                        className="min-w-0 flex-1 text-left"
                      >
                        {editing ? (
                          <input
                            value={editingTitle}
                            onChange={(event) => setEditingTitle(event.target.value)}
                            onBlur={() => commitRenameSession(session.id, editingTitle)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                commitRenameSession(session.id, editingTitle);
                              }
                              if (event.key === "Escape") {
                                event.preventDefault();
                                setEditingSessionId(null);
                              }
                            }}
                            autoFocus
                            className="h-9 w-full rounded-md border border-white/10 bg-ink px-2 text-sm text-white"
                          />
                        ) : (
                          <>
                            <div className="flex items-center gap-2">
                              <p className="truncate text-sm font-medium text-white">{session.title}</p>
                              {session.pinned ? <Pin className="size-3.5 text-gold" aria-hidden /> : null}
                              {sessionGenerating ? <Loader2 className="size-3.5 shrink-0 animate-spin text-mint" aria-hidden /> : null}
                            </div>
                            <p
                              className={cn(
                                "mt-1 text-xs",
                                sessionGenerating ? "text-mint" : sessionFailed ? "text-coral" : "text-stone-400",
                              )}
                            >
                              {getSessionStatusText(session)}
                            </p>
                          </>
                        )}
                      </button>

                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleTogglePin(session.id)}
                          className="grid size-8 place-items-center rounded-md border border-white/10 bg-white/[0.04] text-stone-300 transition hover:border-mint/50 hover:text-mint disabled:cursor-not-allowed disabled:opacity-50"
                          title={session.pinned ? "取消置顶" : "置顶"}
                        >
                          {session.pinned ? <PinOff className="size-3.5" aria-hidden /> : <Pin className="size-3.5" aria-hidden />}
                        </button>
                        <button
                          type="button"
                          onClick={() => beginRenameSession(session)}
                          className="grid size-8 place-items-center rounded-md border border-white/10 bg-white/[0.04] text-stone-300 transition hover:border-mint/50 hover:text-mint disabled:cursor-not-allowed disabled:opacity-50"
                          title="重命名"
                        >
                          <PencilLine className="size-3.5" aria-hidden />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteSession(session.id)}
                          disabled={sessionGenerating}
                          className="grid size-8 place-items-center rounded-md border border-white/10 bg-white/[0.04] text-stone-300 transition hover:border-coral/60 hover:text-coral disabled:cursor-not-allowed disabled:opacity-50"
                          title={sessionGenerating ? "生成中，暂不能删除" : "删除聊天"}
                        >
                          <Trash2 className="size-3.5" aria-hidden />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>

        <section className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
          <section
            id="history"
            ref={chatRef}
            className="min-h-0 flex-1 space-y-5 overflow-y-auto rounded-lg border border-white/10 bg-panel/55 p-4 pb-[30rem] shadow-soft lg:pb-4"
          >
            {activeSession.turns.length === 0 ? <EmptyChatState /> : null}

            {activeSession.turns.map((turn) => (
              <article key={turn.id} className="space-y-3">
                <div className="flex flex-row-reverse items-start gap-3">
                  <Avatar icon={<User className="size-4" aria-hidden />} />
                  <div className="max-w-[min(60rem,92vw)] rounded-2xl rounded-tr-md border border-mint/30 bg-mint px-4 py-3 text-ink">
                    <p className="select-text whitespace-pre-wrap text-sm leading-6 selection:bg-ink selection:text-white">{turn.prompt}</p>
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
                      "min-w-0 max-w-full rounded-2xl rounded-tl-md border border-white/10 bg-ink/70 p-3",
                      turn.status === "error" ? "w-full sm:max-w-[48rem]" : "w-fit",
                    )}
                  >
                    {turn.status === "loading" ? <LoadingBubble count={turn.count || 1} /> : null}
                    {turn.status === "error" ? <p className="text-sm leading-6 text-rose-200">{turn.error}</p> : null}
                    {turn.status === "done" ? (
                      <div className="space-y-3">
                        <p className="text-xs text-stone-400">
                          已生成 {turn.images.length > 0 ? turn.images.length : turn.imageCount || 0} 张图片
                        </p>
                        <div className="grid max-w-full grid-cols-[repeat(auto-fit,minmax(min(16rem,100%),16rem))] gap-3">
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
                    disabled={turn.status === "loading"}
                    className="text-xs text-stone-500 transition hover:text-stone-300 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    删除这一轮
                  </button>
                </div>
              </article>
            ))}

            <div ref={bottomRef} />
          </section>

          <section
            id="composer"
            className={cn(
              "sticky bottom-2 z-30 rounded-2xl border bg-panel/92 p-3 shadow-soft backdrop-blur lg:static lg:bottom-auto lg:z-auto",
              referenceDragging ? "border-mint bg-mint/[0.08]" : "border-white/10",
            )}
            onDragEnter={() => setReferenceDragging(true)}
            onDragOver={(event) => {
              event.preventDefault();
              setReferenceDragging(true);
            }}
            onDragLeave={() => setReferenceDragging(false)}
            onDrop={handleDropReference}
          >
            <form onSubmit={handleGenerate} className="space-y-3">
              {error ? (
                <div className="rounded-md border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">{error}</div>
              ) : null}

              {referencePreviewUrl ? (
                <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-2">
                  <div className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-lg border border-white/10 bg-ink">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={referencePreviewUrl} alt="参考图预览" className="h-full w-full object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-white">参考图已就绪</p>
                    <p className="truncate text-xs text-stone-400">
                      {activeSession.draft.referenceImageMeta?.name || "拖拽图片到输入区可替换参考图"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setActiveSessionDraft((draft) => ({
                        ...draft,
                        referenceImageSource: "",
                        referenceImageMeta: null,
                      }))
                    }
                    className="grid size-8 place-items-center rounded-md border border-white/10 text-stone-300 transition hover:border-coral/60 hover:text-coral"
                    title="移除参考图"
                  >
                    <X className="size-4" aria-hidden />
                    <span className="sr-only">移除参考图</span>
                  </button>
                </div>
              ) : null}

              <textarea
                value={activeSession.draft.prompt}
                onChange={(event) =>
                  setActiveSessionDraft((draft) => ({
                    ...draft,
                    prompt: event.target.value,
                  }))
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
                onPaste={handlePasteReference}
                disabled={activeSessionGenerating}
                maxLength={2000}
                rows={2}
                placeholder={referencePreviewUrl ? "输入你想如何继续修改这张图..." : "输入你想生成的画面，也可直接粘贴图片"}
                className="min-h-20 w-full resize-none border-0 bg-transparent px-1 py-1 text-sm leading-6 text-white outline-none placeholder:text-stone-500 disabled:cursor-not-allowed disabled:opacity-60"
              />

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative shrink-0" ref={uploadMenuRef}>
                  <button
                    type="button"
                    onClick={() => setUploadMenuOpen((current) => !current)}
                    disabled={activeSessionGenerating}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-white/[0.06] px-4 text-sm text-stone-200 transition hover:bg-white/[0.1] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                    title="上传图片"
                  >
                    <ImagePlus className="size-4" aria-hidden />
                    上传
                  </button>

                  {uploadMenuOpen ? (
                    <div className="absolute bottom-full left-0 z-40 mb-2 w-36 overflow-hidden rounded-xl border border-white/10 bg-ink/95 p-1 shadow-soft">
                      <button
                        type="button"
                        onClick={() => {
                          setUploadMenuOpen(false);
                          imageInputRef.current?.click();
                        }}
                        className="block w-full rounded-lg px-3 py-2 text-left text-sm text-stone-200 transition hover:bg-white/[0.06]"
                      >
                        从相册选择
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setUploadMenuOpen(false);
                          cameraInputRef.current?.click();
                        }}
                        className="block w-full rounded-lg px-3 py-2 text-left text-sm text-stone-200 transition hover:bg-white/[0.06]"
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
                    handleReferenceImageFiles(event.target.files?.[0] || null);
                    event.currentTarget.value = "";
                  }}
                  disabled={activeSessionGenerating}
                />
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(event) => {
                    handleReferenceImageFiles(event.target.files?.[0] || null);
                    event.currentTarget.value = "";
                  }}
                  disabled={activeSessionGenerating}
                />

                <div className="hidden h-10 items-center rounded-full bg-white/[0.05] px-4 text-sm text-stone-300 sm:inline-flex">
                  模型&nbsp;<span className="max-w-[14rem] truncate text-white">{apiConfig.model || "gpt-image-2"}</span>
                </div>

                <div className="relative shrink-0" ref={countPanelRef}>
                  <button
                    type="button"
                    onClick={() => setCountPanelOpen((current) => !current)}
                    disabled={activeSessionGenerating}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-white/[0.06] px-4 text-sm text-stone-200 transition hover:bg-white/[0.1] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    张数 <span className="text-white">{activeSession.draft.count}</span>
                    <ChevronDown className={cn("size-4 transition", countPanelOpen ? "rotate-180" : "")} aria-hidden />
                  </button>

                  {countPanelOpen ? (
                    <div className="absolute bottom-full left-0 z-40 mb-2 w-56 rounded-2xl border border-white/10 bg-panel p-3 shadow-[0_18px_50px_rgba(0,0,0,0.45)]">
                      <p className="mb-2 px-1 text-xs text-stone-400">生成数量</p>
                      <div className="grid grid-cols-3 gap-2">
                        {COUNT_OPTIONS.map((item) => (
                          <button
                            key={item}
                            type="button"
                            onClick={() => {
                              setActiveSessionDraft((draft) => ({ ...draft, count: item }));
                              setCountPanelOpen(false);
                            }}
                            disabled={activeSessionGenerating}
                            className={cn(
                              "h-10 rounded-xl text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60",
                              activeSession.draft.count === item
                                ? "bg-mint text-ink"
                                : "bg-white/[0.06] text-stone-200 hover:bg-white/[0.1]",
                            )}
                          >
                            {item}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="relative shrink-0" ref={aspectPanelRef}>
                  <button
                    type="button"
                    onClick={() => setAspectPanelOpen((current) => !current)}
                    disabled={activeSessionGenerating}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-white/[0.06] px-4 text-sm text-stone-200 transition hover:bg-white/[0.1] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    比例 <span className="text-white">{selectedAspectOption.label}</span>
                    <ChevronDown className={cn("size-4 transition", aspectPanelOpen ? "rotate-180" : "")} aria-hidden />
                  </button>

                  {aspectPanelOpen ? (
                    <div className="absolute bottom-full right-0 z-40 mb-2 max-h-[70vh] w-[min(23rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-white/10 bg-panel p-3 shadow-[0_18px_50px_rgba(0,0,0,0.45)]">
                      <p className="mb-2 px-1 text-xs text-stone-400">画面比例</p>
                      <div className="space-y-1">
                        {ASPECT_OPTIONS.map((item) => (
                          <button
                            key={item.size}
                            type="button"
                            onClick={() =>
                              setActiveSessionDraft((draft) => ({
                                ...draft,
                                size: item.size,
                              }))
                            }
                            disabled={activeSessionGenerating}
                            className={cn(
                              "flex h-11 w-full items-center justify-between rounded-xl px-3 text-left transition disabled:cursor-not-allowed disabled:opacity-60",
                              activeSession.draft.size === item.size
                                ? "bg-mint text-ink"
                                : "text-stone-200 hover:bg-white/[0.06]",
                            )}
                          >
                            <span className="font-semibold">{item.label}</span>
                            <span className={cn("text-xs", activeSession.draft.size === item.size ? "text-ink/60" : "text-stone-500")}>
                              {item.detail}
                            </span>
                          </button>
                        ))}
                      </div>

                      <div className="mt-3 border-t border-white/10 pt-3">
                        <p className="mb-2 px-1 text-xs text-stone-400">分辨率</p>
                        <div className="grid grid-cols-3 gap-2">
                          {RESOLUTION_OPTIONS.map((item) => (
                            <button
                              key={item}
                              type="button"
                              onClick={() =>
                                setActiveSessionDraft((draft) => ({
                                  ...draft,
                                  resolution: item,
                                }))
                              }
                              disabled={activeSessionGenerating}
                              className={cn(
                                "h-10 rounded-xl text-sm font-medium uppercase transition disabled:cursor-not-allowed disabled:opacity-60",
                                activeSession.draft.resolution === item
                                  ? "bg-mint text-ink"
                                  : "bg-white/[0.06] text-stone-200 hover:bg-white/[0.1]",
                              )}
                            >
                              {item}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="mt-3 border-t border-white/10 pt-3">
                        <p className="mb-2 px-1 text-xs text-stone-400">质量</p>
                        <div className="grid grid-cols-3 gap-2">
                          {QUALITY_OPTIONS.map((item) => (
                            <button
                              key={item.value}
                              type="button"
                              onClick={() =>
                                setActiveSessionDraft((draft) => ({
                                  ...draft,
                                  quality: item.value,
                                }))
                              }
                              disabled={activeSessionGenerating}
                              className={cn(
                                "h-10 rounded-xl text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60",
                                activeSession.draft.quality === item.value
                                  ? "bg-mint text-ink"
                                  : "bg-white/[0.06] text-stone-200 hover:bg-white/[0.1]",
                              )}
                            >
                              {item.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>

                <button
                  type="submit"
                  disabled={!canGenerate}
                  className="ml-auto inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-mint text-ink transition hover:bg-teal-200 disabled:cursor-not-allowed disabled:bg-stone-600 disabled:text-stone-300"
                  title="发送"
                >
                  {activeSessionGenerating ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <SendHorizontal className="size-5" aria-hidden />}
                  <span className="sr-only">发送</span>
                </button>
              </div>
            </form>
          </section>
        </section>
      </div>

      {showScrollButton ? (
        <button
          type="button"
          onClick={() => bottomRef.current?.scrollIntoView({ behavior: "smooth" })}
          className="fixed bottom-24 right-4 z-40 inline-flex items-center gap-2 rounded-full border border-white/10 bg-ink/90 px-4 py-2 text-sm text-white shadow-soft backdrop-blur"
        >
          <ChevronDown className="size-4" aria-hidden />
          回到底部
        </button>
      ) : null}

      {pendingDeleteTurnId ? (
        <div
          className="fixed inset-0 z-[70] grid place-items-center bg-black/78 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="确认删除这一轮"
          onClick={closeDeleteTurnDialog}
        >
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-panel p-4 shadow-soft" onClick={(event) => event.stopPropagation()}>
            <h3 className="text-sm font-semibold text-white">确认删除这一轮？</h3>
            <p className="mt-2 text-sm leading-6 text-stone-400">删除后这一轮内容和图片都会移除，无法恢复。</p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={closeDeleteTurnDialog}
                className="inline-flex h-9 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] px-3 text-sm text-stone-200 transition hover:border-mint/50 hover:text-mint"
              >
                取消
              </button>
              <button
                type="button"
                onClick={confirmDeleteTurn}
                className="inline-flex h-9 items-center justify-center rounded-md border border-coral/40 bg-coral/15 px-3 text-sm text-coral transition hover:bg-coral hover:text-ink"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ImagePreviewDialog image={previewImage} onClose={() => setPreviewImage(null)} onDownload={handleDownload} />
    </main>
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
    if (!image) return;

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

      <div className="min-h-0 flex-1 overflow-auto p-3 sm:p-6">
        <div className="grid min-h-full place-items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={image.prompt}
            className="max-h-[calc(100vh-7rem)] max-w-full rounded-md object-contain shadow-soft transition-transform duration-150"
            style={{ transform: `scale(${zoom})` }}
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      </div>
    </div>
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
  return <div className="grid size-9 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.05] text-stone-200">{icon}</div>;
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
  const imageSize = parseImageSize(image.size);
  const thumbnailAspectRatio = imageSize ? `${imageSize.width} / ${imageSize.height}` : "1 / 1";
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);

  return (
    <div className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.03]">
      <button
        type="button"
        onClick={() => onPreview(image)}
        className="relative block w-full text-left transition hover:bg-white/[0.04]"
        title="预览大图"
        style={{ aspectRatio: thumbnailAspectRatio }}
      >
        {!imgLoaded && !imgError ? <div className="absolute inset-0 animate-pulse rounded-t-lg bg-white/[0.06]" /> : null}
        {imgError ? <div className="absolute inset-0 grid place-items-center rounded-t-lg bg-white/[0.04] text-xs text-stone-500">图片加载失败</div> : null}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={image.prompt}
          className={cn("h-full w-full object-cover transition-opacity duration-300", imgLoaded ? "opacity-100" : "absolute inset-0 opacity-0")}
          onLoad={() => setImgLoaded(true)}
          onError={() => {
            setImgLoaded(true);
            setImgError(true);
          }}
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

function buildImageEditFormData({
  prompt,
  size,
  resolution,
  quality,
  count,
  apiConfig,
  image,
  referenceImageUrl,
}: {
  prompt: string;
  size: ImageSize;
  resolution: ImageResolution;
  quality: ImageQuality;
  count: number;
  apiConfig: Partial<ImageApiConfig>;
  image: File | null;
  referenceImageUrl?: string;
}) {
  const formData = new FormData();
  formData.append("prompt", prompt);
  formData.append("size", size);
  formData.append("resolution", resolution);
  formData.append("quality", quality);
  formData.append("n", String(count));
  formData.append("apiConfig", JSON.stringify(apiConfig));
  if (image) {
    formData.append("image", image);
  }
  if (referenceImageUrl) {
    formData.append("referenceImageUrl", referenceImageUrl);
  }
  return formData;
}

function persistChatStore(activeSessionId: string, sessions: ChatSession[]) {
  const persistedSessions: PersistedChatSession[] = sessions.slice(0, MAX_SESSION_ITEMS).map((session) => ({
    ...session,
    turns: session.turns.slice(0, MAX_HISTORY_ITEMS).map(({ images, ...rest }) => ({
      ...rest,
      imageCount: images.length || rest.imageIds?.length || rest.imageCount || 0,
      imageIds: rest.imageIds?.length ? rest.imageIds : images.map((image) => image.id),
    })),
  }));

  try {
    const nextStore: SessionStore = {
      activeSessionId,
      sessions: persistedSessions,
    };

    window.localStorage.setItem(CHAT_STORE_KEY, JSON.stringify(nextStore));
  } catch (error) {
    if (isStorageQuotaError(error)) {
      window.localStorage.removeItem(CHAT_STORE_KEY);
    }
  }
}

async function hydrateSessions(sessions: PersistedChatSession[]): Promise<ChatSession[]> {
  return Promise.all(
    sessions.map(async (session) => ({
      ...session,
      turns: await hydratePersistedTurns(session.turns),
    })),
  );
}

async function hydratePersistedTurns(turns: PersistedChatTurn[]): Promise<ChatTurn[]> {
  return Promise.all(
    turns.map(async ({ imageIds, imageCount, ...turn }) => {
      let images: GeneratedImage[] = [];

      if (Array.isArray(imageIds) && imageIds.length > 0) {
        try {
          images = await getImagesFromHistory(imageIds);
        } catch (error) {
          console.warn("[image-history] failed to restore images", error);
        }
      }

      return {
        ...turn,
        imageIds,
        images,
        status: turn.status === "error" ? "error" : ("done" as const),
        imageCount,
      } as ChatTurn & { imageCount: number };
    }),
  );
}

function normalizeSession(session: Partial<PersistedChatSession>): PersistedChatSession {
  return {
    id: typeof session.id === "string" ? session.id : createChatSessionId(),
    title: typeof session.title === "string" && session.title.trim() ? session.title : "新聊天",
    pinned: Boolean(session.pinned),
    turns: Array.isArray(session.turns) ? (session.turns as PersistedChatTurn[]) : [],
    draft: normalizeDraft(session.draft),
    createdAt: typeof session.createdAt === "string" ? session.createdAt : new Date().toISOString(),
    updatedAt: typeof session.updatedAt === "string" ? session.updatedAt : new Date().toISOString(),
    titleEdited: Boolean(session.titleEdited),
  };
}

function normalizeDraft(draft: Partial<ChatDraft> | undefined): ChatDraft {
  return {
    prompt: typeof draft?.prompt === "string" ? draft.prompt : "",
    size: isImageSize(draft?.size) ? draft.size : DEFAULT_DRAFT.size,
    resolution: isImageResolution(draft?.resolution) ? draft.resolution : DEFAULT_DRAFT.resolution,
    quality: isImageQuality(draft?.quality) ? draft.quality : DEFAULT_DRAFT.quality,
    count: typeof draft?.count === "number" && draft.count >= 1 && draft.count <= 9 ? draft.count : DEFAULT_DRAFT.count,
    referenceImageSource: typeof draft?.referenceImageSource === "string" ? draft.referenceImageSource : "",
    referenceImageMeta:
      draft?.referenceImageMeta && typeof draft.referenceImageMeta === "object"
        ? {
            name: typeof draft.referenceImageMeta.name === "string" ? draft.referenceImageMeta.name : undefined,
            type: typeof draft.referenceImageMeta.type === "string" ? draft.referenceImageMeta.type : undefined,
          }
        : null,
  };
}

function isImageSize(value: unknown): value is ImageSize {
  return typeof value === "string" && ASPECT_OPTIONS.some((option) => option.size === value);
}

function isImageResolution(value: unknown): value is ImageResolution {
  return typeof value === "string" && RESOLUTION_OPTIONS.includes(value as ImageResolution);
}

function isImageQuality(value: unknown): value is ImageQuality {
  return typeof value === "string" && QUALITY_OPTIONS.some((option) => option.value === value);
}

function createBlankSession(): ChatSession {
  const id = createChatSessionId();
  const now = new Date().toISOString();
  return {
    id,
    title: "新聊天",
    pinned: false,
    turns: [],
    draft: { ...DEFAULT_DRAFT },
    createdAt: now,
    updatedAt: now,
    titleEdited: false,
  };
}

function deriveTitleFromPrompt(prompt: string) {
  const text = prompt.trim().replace(/\s+/g, " ");
  if (!text) return "新聊天";

  const firstSentence = text.split(/[\n。.!?！？；;]+/)[0]?.trim() || text;
  const title = firstSentence.slice(0, 24);
  return title || "新聊天";
}

function getImageIdsFromTurns(turns: ChatTurn[]) {
  return turns.flatMap(getImageIdsFromTurn);
}

function getImageIdsFromTurn(turn: ChatTurn) {
  return turn.imageIds?.length ? turn.imageIds : turn.images.map((image) => image.id);
}

function getImageIdsFromTurnsFromSession(session: ChatSession) {
  return session.turns.flatMap((turn) => (turn.imageIds?.length ? turn.imageIds : turn.images.map((image) => image.id)));
}

function hasLoadingTurn(session: ChatSession) {
  return session.turns.some((turn) => turn.status === "loading");
}

function hasErrorTurn(session: ChatSession) {
  return session.turns.some((turn) => turn.status === "error");
}

function getSessionStatusText(session: ChatSession) {
  if (hasLoadingTurn(session)) {
    return "生成中 · 可切换查看其他聊天";
  }

  if (hasErrorTurn(session)) {
    return "有生成失败 · 点击查看";
  }

  return `${session.turns.length} 轮 · ${formatSessionTime(session.updatedAt)}`;
}

function formatSessionTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "刚刚";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
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

function getFirstImageFileFromDataTransfer(dataTransfer: DataTransfer) {
  const itemFile = Array.from(dataTransfer.items || [])
    .find((item) => item.kind === "file" && item.type.startsWith("image/"))
    ?.getAsFile();

  if (itemFile) {
    return itemFile;
  }

  return Array.from(dataTransfer.files || []).find((file) => file.type.startsWith("image/")) || null;
}

async function buildReferenceFileFromSource(src: string) {
  const normalizedSrc = src.trim();
  if (!normalizedSrc) {
    return null;
  }

  if (normalizedSrc.startsWith("data:")) {
    try {
      const blob = dataUrlToBlob(normalizedSrc);
      if (!blob.type.startsWith("image/")) {
        return null;
      }

      return new File([blob], getReferenceFileName(blob.type), { type: blob.type || "image/png" });
    } catch {
      return null;
    }
  }

  const blob = await fetchImageBlob(normalizedSrc);
  if (!blob) {
    return null;
  }

  return new File([blob], getReferenceFileName(blob.type), { type: blob.type || "image/png" });
}

async function fetchImageBlob(src: string) {
  const candidates = /^https?:\/\//i.test(src)
    ? [src, `/api/image-proxy?url=${encodeURIComponent(src)}`]
    : [src];

  for (const candidate of candidates) {
    try {
      const response = await fetch(candidate, { cache: "no-store" });
      if (!response.ok) {
        continue;
      }

      const contentType = response.headers.get("content-type")?.split(";")[0]?.trim() || "";
      const blob = await response.blob();
      const type = blob.type || contentType;
      if (!type.startsWith("image/") || blob.size === 0) {
        continue;
      }

      return blob.type ? blob : new Blob([blob], { type });
    } catch {
      // Try the next candidate.
    }
  }

  return null;
}

function dataUrlToBlob(input: string) {
  const [metadata = "", payload = ""] = input.split(",");
  const mimeMatch = /^data:([^;,]+)/i.exec(metadata);
  const mimeType = mimeMatch?.[1] || "image/png";
  const isBase64 = metadata.toLowerCase().includes(";base64");
  const raw = isBase64 ? payload : btoa(decodeURIComponent(payload));
  const binary = atob(raw);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: mimeType });
}

function getReferenceFileName(type: string) {
  if (type === "image/jpeg") return "reference.jpg";
  if (type === "image/webp") return "reference.webp";
  return "reference.png";
}

function getFriendlyGenerateErrorMessage(error: unknown) {
  if (!(error instanceof Error)) {
    return "图片生成失败，请稍后重试。";
  }

  const message = error.message.trim();
  const normalized = message.toLowerCase();

  if (
    normalized === "failed to fetch" ||
    normalized.includes("fetch failed") ||
    normalized.includes("networkerror") ||
    normalized.includes("load failed")
  ) {
    return "网络请求失败，可能是参考图地址暂时不可访问。请重试一次，或重新选择/上传参考图。";
  }

  return message || "图片生成失败，请稍后重试。";
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

async function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Failed to read file."));
    reader.readAsDataURL(file);
  });
}
