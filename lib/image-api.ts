import { createId } from "@/lib/utils";
import { resolveImageEditUrl, resolveImageGenerationUrl } from "@/lib/api-url";
import type {
  GeneratedImage,
  ImageApiConfig,
  ImageEditParams,
  ImageGenerateParams,
  ImageMode,
} from "@/types/image";

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

export async function generateImages(
  params: ImageGenerateParams,
  apiConfig?: Partial<ImageApiConfig>,
): Promise<GeneratedImage[]> {
  const apiUrl = resolveImageGenerationUrl(apiConfig?.apiUrl || process.env.IMAGE_API_URL);
  const apiKey = apiConfig?.apiKey || process.env.IMAGE_API_KEY;
  const model = apiConfig?.model || process.env.IMAGE_MODEL || "gpt-image-2";

  if (!apiUrl || !apiKey) {
    throw new Error("服务端图片 API 尚未配置，请检查 IMAGE_API_URL 和 IMAGE_API_KEY。");
  }

  const response = await fetch(apiUrl, {
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
  });

  const responseText = await response.text();
  const payload = parseProviderPayload(responseText);

  return normalizeProviderImages({
    response,
    payload,
    prompt: params.prompt,
    mode: "generate",
    size: params.size,
    resolution: params.resolution,
    quality: params.quality,
    fallbackMessage: "图片生成接口请求失败",
  });
}

export async function editImages(
  params: ImageEditParams,
  apiConfig?: Partial<ImageApiConfig>,
): Promise<GeneratedImage[]> {
  const apiUrl = resolveImageEditUrl(apiConfig?.apiUrl || process.env.IMAGE_API_URL);
  const apiKey = apiConfig?.apiKey || process.env.IMAGE_API_KEY;
  const model = apiConfig?.model || process.env.IMAGE_MODEL || "gpt-image-2";

  if (!apiUrl || !apiKey) {
    throw new Error("服务端图片 API 尚未配置，请检查 IMAGE_API_URL 和 IMAGE_API_KEY。");
  }

  const formData = new FormData();
  formData.append("model", model);
  formData.append("prompt", params.prompt);
  formData.append("size", params.size);
  formData.append("resolution", params.resolution);
  formData.append("quality", params.quality);
  formData.append("n", String(params.n));

  if (params.image) {
    formData.append("image", params.image, params.image.name || "reference.png");
  } else if (params.referenceImageUrl) {
    formData.append("referenceImageUrl", params.referenceImageUrl);
  } else {
    throw new Error("缺少参考图。");
  }

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  const responseText = await response.text();
  const payload = parseProviderPayload(responseText);

  return normalizeProviderImages({
    response,
    payload,
    prompt: params.prompt,
    mode: "edit",
    size: params.size,
    resolution: params.resolution,
    quality: params.quality,
    fallbackMessage: "图生图接口请求失败",
  });
}

function normalizeProviderImages({
  response,
  payload,
  prompt,
  mode,
  size,
  resolution,
  quality,
  fallbackMessage,
}: {
  response: Response;
  payload: ProviderErrorPayload;
  prompt: string;
  mode: ImageMode;
  size: ImageGenerateParams["size"];
  resolution: ImageGenerateParams["resolution"];
  quality: ImageGenerateParams["quality"];
  fallbackMessage: string;
}) {
  if (!response.ok) {
    const providerMessage = getProviderErrorMessage(payload);
    throw new Error(providerMessage || `${fallbackMessage}，状态码 ${response.status}。`);
  }

  const rawImages = payload.data || payload.images || payload.output || [];

  if (!Array.isArray(rawImages) || rawImages.length === 0) {
    throw new Error("图片接口没有返回可展示的图片。");
  }

  return rawImages.map((image) => ({
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
    return { message: responseText.slice(0, 500) };
  }
}

function getProviderErrorMessage(payload: ProviderErrorPayload) {
  if (typeof payload.error === "string") {
    return payload.error;
  }

  return payload.error?.message || payload.message || payload.detail;
}
