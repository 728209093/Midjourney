import { createId } from "@/lib/utils";
import { resolveImageEditUrl, resolveImageGenerationUrl } from "@/lib/api-url";
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

export async function generateImages(
  params: ImageGenerateParams,
  apiConfig?: Partial<ImageApiConfig>,
): Promise<GeneratedImage[]> {
  const endpoint = resolveImageGenerationUrl(apiConfig?.apiUrl || process.env.IMAGE_API_URL);
  const apiKey = apiConfig?.apiKey || process.env.IMAGE_API_KEY;
  const model = apiConfig?.model || process.env.IMAGE_MODEL || "gpt-image-2";

  if (!endpoint || !apiKey) {
    throw new Error("服务端图片 API 尚未配置，请检查 IMAGE_API_URL 和 IMAGE_API_KEY。");
  }

  assertValidApiKey(apiKey);

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
  const endpoint = resolveImageEditUrl(apiConfig?.apiUrl || process.env.IMAGE_API_URL);
  const apiKey = apiConfig?.apiKey || process.env.IMAGE_API_KEY;
  const model = apiConfig?.model || process.env.IMAGE_MODEL || "gpt-image-2";

  if (!endpoint || !apiKey) {
    throw new Error("服务端图片 API 尚未配置，请检查 IMAGE_API_URL 和 IMAGE_API_KEY。");
  }

  const uploadedImages = [...(params.images || []), ...(params.image ? [params.image] : [])].slice(0, MAX_REFERENCE_IMAGES);

  if (uploadedImages.length === 0 && !params.referenceImageUrl) {
    throw new Error("缺少参考图。");
  }

  assertValidApiKey(apiKey);

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
