import { createId } from "@/lib/utils";
import {
  resolveGeminiGenerateContentUrl,
  resolveImageEditUrl,
  resolveImageGenerationUrl,
} from "@/lib/api-url";
import type {
  GeneratedImage,
  ImageApiConfig,
  ImageEditParams,
  ImageGenerateParams,
  ImageMode,
} from "@/types/image";

const MAX_REFERENCE_IMAGES = 8;

type ProviderImage = {
  url?: string;
  b64_json?: string;
  base64?: string;
};

type ProviderResponse = {
  data?: ProviderImage[];
  images?: ProviderImage[];
  output?: ProviderImage[];
};

type ProviderErrorPayload = ProviderResponse & {
  error?: { message?: string } | string;
  message?: string;
  detail?: string;
};

type GeminiImageOutput = {
  type?: string;
  data?: string;
  uri?: string;
  url?: string;
  b64_json?: string;
  base64?: string;
  mime_type?: string;
  mimeType?: string;
};

type GeminiInlineData = {
  data?: string;
  mime_type?: string;
  mimeType?: string;
};

type GeminiInputContent =
  | {
      type: "text";
      text: string;
    }
  | {
      type: "image";
      data?: string;
      uri?: string;
      mime_type?: string;
    };

type GeminiInteractionPayload = ProviderErrorPayload & {
  output_image?: GeminiImageOutput;
  output?: GeminiImageOutput | GeminiImageOutput[] | Array<{ content?: unknown }>;
  steps?: Array<{
    output_image?: GeminiImageOutput;
    content?: unknown;
  }>;
  candidates?: Array<{
    content?: {
      parts?: Array<{
        inlineData?: GeminiInlineData;
        inline_data?: GeminiInlineData;
        fileData?: { fileUri?: string; mimeType?: string };
        file_data?: { file_uri?: string; mime_type?: string };
      }>;
    };
  }>;
};

type ProviderRequestContext = {
  kind: ImageMode;
  endpoint: string;
  prompt: string;
  createRequestInit: () => RequestInit;
  fallbackMessage: string;
  logMeta: {
    model: string;
    n: number;
    size: ImageGenerateParams["size"];
    resolution: ImageGenerateParams["resolution"];
    quality: ImageGenerateParams["quality"];
  };
};

class ProviderRequestError extends Error {
  retryable: boolean;

  status?: number;

  endpoint: string;

  responseSnippet?: string;

  constructor(
    message: string,
    options: {
      retryable: boolean;
      status?: number;
      endpoint: string;
      responseSnippet?: string;
    },
  ) {
    super(message);
    this.name = "ProviderRequestError";
    this.retryable = options.retryable;
    this.status = options.status;
    this.endpoint = options.endpoint;
    this.responseSnippet = options.responseSnippet;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

const PROVIDER_MAX_ATTEMPTS = 3;
const PROVIDER_RETRY_DELAYS_MS = [0, 400, 1200] as const;
const IMAGE_SIZE_TO_ASPECT_RATIO: Record<ImageGenerateParams["size"], string> = {
  "1024x1024": "1:1",
  "1536x864": "16:9",
  "864x1536": "9:16",
  "1536x1024": "3:2",
  "1024x1536": "2:3",
  "1408x1056": "4:3",
  "1056x1408": "3:4",
  "1536x656": "21:9",
};

function assertValidApiKey(apiKey: string) {
  if (!/^[\x20-\x7E]+$/.test(apiKey)) {
    throw new Error("API Key 不能包含中文、全角字符或换行，请在设置里填入真实的英文/数字密钥。");
  }
}

function getSafeReferenceFileName(image: File, index: number) {
  return `reference-${index + 1}.${getImageFileExtension(image.type)}`;
}

function getImageFileExtension(type: string) {
  if (type === "image/jpeg") return "jpg";
  if (type === "image/webp") return "webp";
  return "png";
}

function isGeminiImageModel(model: string) {
  const normalized = model.toLowerCase();
  return normalized.startsWith("gemini-") && normalized.includes("image");
}

export async function generateImages(
  params: ImageGenerateParams,
  apiConfig?: Partial<ImageApiConfig>,
): Promise<GeneratedImage[]> {
  const baseUrl = apiConfig?.apiUrl || process.env.IMAGE_API_URL;
  const apiKey = apiConfig?.apiKey || process.env.IMAGE_API_KEY;
  const model = apiConfig?.model || process.env.IMAGE_MODEL || "gpt-image-2";
  const endpoint = resolveImageGenerationUrl(baseUrl);

  if (!endpoint || !apiKey) {
    throw new Error("服务端图片 API 尚未配置，请检查 IMAGE_API_URL 和 IMAGE_API_KEY。");
  }

  assertValidApiKey(apiKey);

  if (isGeminiImageModel(model)) {
    return requestGeminiImagesWithFallback({
      kind: "generate",
      baseUrl,
      openAiEndpoint: endpoint,
      apiKey,
      model,
      prompt: params.prompt,
      contents: [{ type: "text", text: params.prompt }],
      size: params.size,
      resolution: params.resolution,
      quality: params.quality,
      requestedCount: params.n,
    });
  }

  return requestProviderImages({
    kind: "generate",
    endpoint,
    prompt: params.prompt,
    createRequestInit: () => ({
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        prompt: params.prompt,
        size: params.size,
        resolution: params.resolution,
        quality: params.quality,
        n: params.n,
      }),
    }),
    fallbackMessage: "图片生成接口请求失败",
    logMeta: {
      model,
      n: params.n,
      size: params.size,
      resolution: params.resolution,
      quality: params.quality,
    },
  });
}

export async function editImages(
  params: ImageEditParams,
  apiConfig?: Partial<ImageApiConfig>,
): Promise<GeneratedImage[]> {
  const baseUrl = apiConfig?.apiUrl || process.env.IMAGE_API_URL;
  const apiKey = apiConfig?.apiKey || process.env.IMAGE_API_KEY;
  const model = apiConfig?.model || process.env.IMAGE_MODEL || "gpt-image-2";
  const endpoint = resolveImageEditUrl(baseUrl);

  if (!endpoint || !apiKey) {
    throw new Error("服务端图片 API 尚未配置，请检查 IMAGE_API_URL 和 IMAGE_API_KEY。");
  }

  const uploadedImages = [...(params.images || []), ...(params.image ? [params.image] : [])].slice(0, MAX_REFERENCE_IMAGES);

  if (uploadedImages.length === 0 && !params.referenceImageUrl) {
    throw new Error("缺少参考图。");
  }

  assertValidApiKey(apiKey);

  if (isGeminiImageModel(model)) {
    const contents: GeminiInputContent[] = [
      { type: "text", text: params.prompt },
      ...(await Promise.all(uploadedImages.map(fileToGeminiInput))),
      ...(params.referenceImageUrl ? ([{ type: "image", uri: params.referenceImageUrl }] satisfies GeminiInputContent[]) : []),
    ];

    return requestGeminiImagesWithFallback({
      kind: "edit",
      baseUrl,
      openAiEndpoint: endpoint,
      apiKey,
      model,
      prompt: params.prompt,
      contents,
      size: params.size,
      resolution: params.resolution,
      quality: params.quality,
      requestedCount: params.n,
    });
  }

  return requestProviderImages({
    kind: "edit",
    endpoint,
    prompt: params.prompt,
    createRequestInit: () => {
      const formData = new FormData();
      formData.append("model", model);
      formData.append("prompt", params.prompt);
      formData.append("size", params.size);
      formData.append("resolution", params.resolution);
      formData.append("quality", params.quality);
      formData.append("n", String(params.n));

      if (uploadedImages.length > 0) {
        uploadedImages.forEach((image, index) => {
          formData.append("image", image, getSafeReferenceFileName(image, index));
        });
      } else if (params.referenceImageUrl) {
        formData.append("referenceImageUrl", params.referenceImageUrl);
      }

      return {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: formData,
      };
    },
    fallbackMessage: "图生图接口请求失败",
    logMeta: {
      model,
      n: params.n,
      size: params.size,
      resolution: params.resolution,
      quality: params.quality,
    },
  });
}

async function requestProviderImages(context: ProviderRequestContext): Promise<GeneratedImage[]> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= PROVIDER_MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(context.endpoint, context.createRequestInit());
      const responseText = await response.text();
      const payload = parseProviderPayload(responseText);

      const images = normalizeProviderImages({
        response,
        responseText,
        payload,
        prompt: context.prompt,
        mode: context.kind,
        size: context.logMeta.size,
        resolution: context.logMeta.resolution,
        quality: context.logMeta.quality,
        requestedCount: context.logMeta.n,
        fallbackMessage: context.fallbackMessage,
        endpoint: context.endpoint,
      });

      if (attempt > 1) {
        console.info(`[image-api:${context.kind}] succeeded after retry`, {
          attempt,
          endpoint: sanitizeEndpoint(context.endpoint),
          ...context.logMeta,
        });
      }

      return images;
    } catch (error) {
      lastError = error;
      const retryable = isRetryableProviderError(error);
      logProviderAttempt(context, attempt, error, retryable);

      if (!retryable || attempt === PROVIDER_MAX_ATTEMPTS) {
        break;
      }

      await sleep(PROVIDER_RETRY_DELAYS_MS[attempt] ?? 1000);
    }
  }

  if (lastError instanceof Error) {
    throw lastError;
  }

  throw new Error(context.fallbackMessage);
}

async function requestGeminiImagesWithFallback(context: {
  kind: ImageMode;
  baseUrl?: string;
  openAiEndpoint?: string;
  apiKey: string;
  model: string;
  prompt: string;
  contents: GeminiInputContent[];
  size: ImageGenerateParams["size"];
  resolution: ImageGenerateParams["resolution"];
  quality: ImageGenerateParams["quality"];
  requestedCount: number;
}): Promise<GeneratedImage[]> {
  let lastError: unknown;

  if (context.kind === "generate" && context.openAiEndpoint) {
    try {
      return await requestProviderImages({
        kind: context.kind,
        endpoint: context.openAiEndpoint,
        prompt: context.prompt,
        createRequestInit: () => ({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${context.apiKey}`,
          },
          body: JSON.stringify({
            model: context.model,
            prompt: context.prompt,
            size: context.size,
            resolution: context.resolution,
            quality: context.quality,
            n: context.requestedCount,
          }),
        }),
        fallbackMessage: "Gemini 兼容图片生成接口请求失败",
        logMeta: {
          model: context.model,
          n: context.requestedCount,
          size: context.size,
          resolution: context.resolution,
          quality: context.quality,
        },
      });
    } catch (error) {
      lastError = error;
      if (!shouldTryNextGeminiStrategy(error)) {
        throw error;
      }
    }
  }

  try {
    const generateContentEndpoint = resolveGeminiGenerateContentUrl(context.baseUrl, context.model);
    if (!generateContentEndpoint) {
      throw new Error("服务端图片 API 尚未配置，请检查 IMAGE_API_URL 和 IMAGE_API_KEY。");
    }

    return await requestGeminiInteractionImages({
      ...context,
      endpoint: generateContentEndpoint,
    });
  } catch (error) {
    lastError = error;
    if (!shouldTryNextGeminiStrategy(error)) {
      throw error;
    }
  }

  if (lastError instanceof Error) {
    throw lastError;
  }

  throw new Error("Gemini 图片生成接口请求失败");
}

function shouldTryNextGeminiStrategy(error: unknown) {
  if (error instanceof ProviderRequestError) {
    if (error.status === 401 || error.status === 403) {
      return false;
    }

    const message = error.message.toLowerCase();
    return (
      error.status === 400 ||
      error.status === 404 ||
      error.status === 405 ||
      message.includes("invalid url") ||
      message.includes("unsupported") ||
      message.includes("not found") ||
      message.includes("没有返回可展示的图片") ||
      message.includes("no displayable image")
    );
  }

  return false;
}

async function requestGeminiInteractionImages(context: {
  kind: ImageMode;
  endpoint: string;
  apiKey: string;
  model: string;
  prompt: string;
  contents: GeminiInputContent[];
  size: ImageGenerateParams["size"];
  resolution: ImageGenerateParams["resolution"];
  quality: ImageGenerateParams["quality"];
  requestedCount: number;
}): Promise<GeneratedImage[]> {
  const images: GeneratedImage[] = [];

  while (images.length < context.requestedCount) {
    const nextImages = await requestGeminiInteractionImageBatch(context);
    images.push(...nextImages);

    if (nextImages.length === 0) {
      break;
    }
  }

  return images.slice(0, context.requestedCount);
}

async function requestGeminiInteractionImageBatch(context: {
  kind: ImageMode;
  endpoint: string;
  apiKey: string;
  model: string;
  prompt: string;
  contents: GeminiInputContent[];
  size: ImageGenerateParams["size"];
  resolution: ImageGenerateParams["resolution"];
  quality: ImageGenerateParams["quality"];
  requestedCount: number;
}): Promise<GeneratedImage[]> {
  const providerContext: ProviderRequestContext = {
    kind: context.kind,
    endpoint: context.endpoint,
    prompt: context.prompt,
    createRequestInit: () => ({}),
    fallbackMessage: "Gemini 图片生成接口请求失败",
    logMeta: {
      model: context.model,
      n: context.requestedCount,
      size: context.size,
      resolution: context.resolution,
      quality: context.quality,
    },
  };
  let lastError: unknown;

  for (let attempt = 1; attempt <= PROVIDER_MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(context.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": context.apiKey,
          Authorization: `Bearer ${context.apiKey}`,
        },
        body: JSON.stringify({
          contents: [
            {
              parts: context.contents.map(geminiInputToPart),
            },
          ],
          generationConfig: {
            responseModalities: ["TEXT", "IMAGE"],
            responseFormat: {
              image: {
                aspectRatio: IMAGE_SIZE_TO_ASPECT_RATIO[context.size],
                imageSize: context.resolution.toUpperCase(),
              },
            },
          },
        }),
      });
      const responseText = await response.text();
      const payload = parseProviderPayload(responseText) as GeminiInteractionPayload;
      const images = normalizeGeminiInteractionImages({
        response,
        responseText,
        payload,
        prompt: context.prompt,
        mode: context.kind,
        size: context.size,
        resolution: context.resolution,
        quality: context.quality,
        endpoint: context.endpoint,
      });

      if (attempt > 1) {
        console.info(`[image-api:${context.kind}] Gemini succeeded after retry`, {
          attempt,
          endpoint: sanitizeEndpoint(context.endpoint),
          model: context.model,
          size: context.size,
          resolution: context.resolution,
          quality: context.quality,
        });
      }

      return images;
    } catch (error) {
      lastError = error;
      const retryable = isRetryableProviderError(error);
      logProviderAttempt(providerContext, attempt, error, retryable);

      if (!retryable || attempt === PROVIDER_MAX_ATTEMPTS) {
        break;
      }

      await sleep(PROVIDER_RETRY_DELAYS_MS[attempt] ?? 1000);
    }
  }

  if (lastError instanceof Error) {
    throw lastError;
  }

  throw new Error("Gemini 图片生成接口请求失败");
}

function normalizeGeminiInteractionImages({
  response,
  responseText,
  payload,
  prompt,
  mode,
  size,
  resolution,
  quality,
  endpoint,
}: {
  response: Response;
  responseText: string;
  payload: GeminiInteractionPayload;
  prompt: string;
  mode: ImageMode;
  size: ImageGenerateParams["size"];
  resolution: ImageGenerateParams["resolution"];
  quality: ImageGenerateParams["quality"];
  endpoint: string;
}): GeneratedImage[] {
  if (!response.ok) {
    const providerMessage = getProviderErrorMessage(payload);
    const responseSnippet = summarizeResponseText(responseText, providerMessage);
    throw new ProviderRequestError(providerMessage || `Gemini 图片生成失败，状态码 ${response.status}。`, {
      retryable: isRetryableStatus(response.status) || isLikelyTransientMessage(providerMessage),
      status: response.status,
      endpoint,
      responseSnippet,
    });
  }

  const rawImages = extractGeminiImageOutputs(payload);

  if (rawImages.length === 0) {
    throw new ProviderRequestError("Gemini 没有返回可展示的图片。", {
      retryable: true,
      status: response.status,
      endpoint,
      responseSnippet: summarizeResponseText(responseText),
    });
  }

  return rawImages.map((image) => ({
    id: createId(),
    url: image.uri,
    base64: image.data ? normalizeGeminiBase64Image(image) : undefined,
    prompt,
    mode,
    size,
    resolution,
    quality,
    createdAt: new Date().toISOString(),
  }));
}

function extractGeminiImageOutputs(payload: GeminiInteractionPayload): GeminiImageOutput[] {
  const images: GeminiImageOutput[] = [];

  payload.candidates?.forEach((candidate) => {
    candidate.content?.parts?.forEach((part) => {
      const inlineData = part.inlineData || part.inline_data;
      if (inlineData?.data) {
        images.push({
          data: inlineData.data,
          mime_type: inlineData.mime_type || inlineData.mimeType || "image/png",
        });
      }

      if (part.fileData?.fileUri) {
        images.push({
          uri: part.fileData.fileUri,
          mime_type: part.fileData.mimeType || "image/png",
        });
      }

      if (part.file_data?.file_uri) {
        images.push({
          uri: part.file_data.file_uri,
          mime_type: part.file_data.mime_type || "image/png",
        });
      }
    });
  });
  pushGeminiImage(images, payload.output_image);
  pushGeminiImage(images, payload.output);
  pushGeminiImage(images, payload.data);
  pushGeminiImage(images, payload.images);
  payload.steps?.forEach((step) => {
    pushGeminiImage(images, step.output_image);
    pushGeminiImage(images, step.content);
  });

  return images;
}

function geminiInputToPart(content: GeminiInputContent) {
  if (content.type === "text") {
    return { text: content.text };
  }

  if (content.uri) {
    return {
      file_data: {
        file_uri: content.uri,
        mime_type: content.mime_type || "image/png",
      },
    };
  }

  return {
    inline_data: {
      mime_type: content.mime_type || "image/png",
      data: content.data || "",
    },
  };
}

function pushGeminiImage(images: GeminiImageOutput[], value: unknown) {
  if (!value) {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => pushGeminiImage(images, item));
    return;
  }

  if (typeof value !== "object") {
    return;
  }

  const image = value as GeminiImageOutput & { content?: unknown; output_image?: unknown };
  const mimeType = image.mime_type || image.mimeType || "";
  const data = image.data || image.b64_json || image.base64;
  const uri = image.uri || image.url;
  const looksLikeImage = image.type === "image" || mimeType.startsWith("image/") || Boolean(data || uri);

  if (looksLikeImage && (data || uri)) {
    images.push({
      ...image,
      data,
      uri,
    });
  }

  pushGeminiImage(images, image.output_image);
  pushGeminiImage(images, image.content);
}

function normalizeGeminiBase64Image(image: GeminiImageOutput) {
  const data = image.data || "";
  if (data.startsWith("data:")) {
    return data;
  }

  return `data:${image.mime_type || image.mimeType || "image/png"};base64,${data}`;
}

async function fileToGeminiInput(image: File): Promise<GeminiInputContent> {
  const buffer = Buffer.from(await image.arrayBuffer());
  return {
    type: "image",
    data: buffer.toString("base64"),
    mime_type: image.type || "image/png",
  };
}

function normalizeProviderImages({
  response,
  responseText,
  payload,
  prompt,
  mode,
  size,
  resolution,
  quality,
  requestedCount,
  fallbackMessage,
  endpoint,
}: {
  response: Response;
  responseText: string;
  payload: ProviderErrorPayload;
  prompt: string;
  mode: ImageMode;
  size: ImageGenerateParams["size"];
  resolution: ImageGenerateParams["resolution"];
  quality: ImageGenerateParams["quality"];
  requestedCount: number;
  fallbackMessage: string;
  endpoint: string;
}) {
  if (!response.ok) {
    const providerMessage = getProviderErrorMessage(payload);
    const responseSnippet = summarizeResponseText(responseText, providerMessage);
    throw new ProviderRequestError(
      providerMessage || `${fallbackMessage}，状态码 ${response.status}。`,
      {
        retryable: isRetryableStatus(response.status) || isLikelyTransientMessage(providerMessage),
        status: response.status,
        endpoint,
        responseSnippet,
      },
    );
  }

  const rawImages = payload.data || payload.images || payload.output || [];

  if (!Array.isArray(rawImages) || rawImages.length === 0) {
    throw new ProviderRequestError("图片接口没有返回可展示的图片。", {
      retryable: true,
      status: response.status,
      endpoint,
      responseSnippet: summarizeResponseText(responseText),
    });
  }

  return rawImages.slice(0, requestedCount).map((image) => ({
    id: createId(),
    url: image.url,
    base64: image.b64_json || image.base64,
    prompt,
    mode,
    size,
    resolution,
    quality,
    createdAt: new Date().toISOString(),
  }));
}

function parseProviderPayload(responseText: string): ProviderErrorPayload {
  if (!responseText) {
    return {};
  }

  try {
    return JSON.parse(responseText) as ProviderErrorPayload;
  } catch {
    const snippet = summarizeResponseText(responseText);
    return {
      message: snippet.startsWith("<")
        ? "图片 API 返回了 HTML 页面，请检查 API 地址是否正确或稍后重试。"
        : snippet,
    };
  }
}

function getProviderErrorMessage(payload: ProviderErrorPayload) {
  if (typeof payload.error === "string") {
    return payload.error;
  }

  return payload.error?.message || payload.message || payload.detail;
}

function isRetryableProviderError(error: unknown) {
  if (error instanceof ProviderRequestError) {
    return error.retryable;
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes("fetch failed") ||
      message.includes("networkerror") ||
      message.includes("socket hang up") ||
      message.includes("econnreset") ||
      message.includes("etimedout") ||
      message.includes("timeout") ||
      message.includes("openai_error") ||
      message.includes("internal server error")
    );
  }

  return false;
}

function isRetryableStatus(status?: number) {
  return status === 500 || status === 502 || status === 503 || status === 504;
}

function isLikelyTransientMessage(message?: string) {
  if (!message) {
    return false;
  }

  const normalized = message.toLowerCase();
  return (
    normalized.includes("openai_error") ||
    normalized.includes("internal server error") ||
    normalized.includes("temporarily") ||
    normalized.includes("timeout")
  );
}

function summarizeResponseText(responseText: string, fallback = "") {
  const snippet = responseText.trim().replace(/\s+/g, " ").slice(0, 300);
  return snippet || fallback.slice(0, 300);
}

function sanitizeEndpoint(endpoint: string) {
  try {
    const url = new URL(endpoint);
    return `${url.origin}${url.pathname}`;
  } catch {
    return endpoint;
  }
}

function logProviderAttempt(
  context: ProviderRequestContext,
  attempt: number,
  error: unknown,
  retryable: boolean,
) {
  const details = serializeProviderError(error);
  const logger = retryable ? console.warn : console.error;

  logger(`[image-api:${context.kind}] 第 ${attempt}/${PROVIDER_MAX_ATTEMPTS} 次请求失败`, {
    endpoint: sanitizeEndpoint(context.endpoint),
    retryable,
    promptLength: context.prompt.length,
    promptPreview: context.prompt.slice(0, 80),
    ...context.logMeta,
    ...details,
  });
}

function serializeProviderError(error: unknown) {
  if (error instanceof ProviderRequestError) {
    return {
      name: error.name,
      message: error.message,
      status: error.status,
      responseSnippet: error.responseSnippet,
    };
  }

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return {
    message: String(error),
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
