import type {
  ImageApiConfig,
  ImageGenerateParams,
  ImageQuality,
  ImageResolution,
  ImageSize,
} from "@/types/image";
import { normalizeImageSize } from "@/lib/image-size";
import { validateApiBaseUrl } from "@/lib/api-url";

export const IMAGE_SIZES: ImageSize[] = [
  "1024x1024",
  "1536x864",
  "864x1536",
  "1536x1024",
  "1024x1536",
  "1408x1056",
  "1056x1408",
  "1536x656",
];
export const IMAGE_RESOLUTIONS: ImageResolution[] = ["1k", "2k", "4k"];
export const IMAGE_QUALITIES: ImageQuality[] = ["low", "medium", "high"];

export function validateGenerateRequest(input: unknown):
  | {
      ok: true;
      data: ImageGenerateParams;
      apiConfig?: Partial<ImageApiConfig>;
      referenceImageUrl?: string;
    }
  | { ok: false; message: string } {
  if (!input || typeof input !== "object") {
    return { ok: false, message: "请求参数格式不正确。" };
  }

  const body = input as Record<string, unknown>;
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const sizeRaw = typeof body.size === "string" ? body.size : "";
  const size = normalizeImageSize(sizeRaw) || sizeRaw;
  const resolution = typeof body.resolution === "string" ? body.resolution.toLowerCase() : "1k";
  const quality = body.quality;
  const n = typeof body.n === "number" ? body.n : Number(body.n);

  if (!prompt) {
    return { ok: false, message: "请输入图片描述。" };
  }

  if (prompt.length > 2000) {
    return { ok: false, message: "图片描述不能超过 2000 个字符。" };
  }

  if (!normalizeImageSize(sizeRaw)) {
    return { ok: false, message: "图片尺寸格式不正确，需为 WIDTHxHEIGHT 且宽高需为 16 的倍数。" };
  }

  if (!IMAGE_RESOLUTIONS.includes(resolution as ImageResolution)) {
    return { ok: false, message: "分辨率仅支持 1K、2K 或 4K。" };
  }

  if (!IMAGE_QUALITIES.includes(quality as ImageQuality)) {
    return { ok: false, message: "图片质量不在允许范围内。" };
  }

  if (!Number.isInteger(n) || n < 1 || n > 9) {
    return { ok: false, message: "生成数量必须是 1 到 9 之间的整数。" };
  }

  const apiConfig = parseApiConfig(body.apiConfig);
  if (!apiConfig.ok) {
    return { ok: false, message: apiConfig.message };
  }

  const referenceImageUrl =
    typeof body.referenceImageUrl === "string" && body.referenceImageUrl.trim()
      ? body.referenceImageUrl.trim()
      : undefined;

  if (referenceImageUrl) {
    try {
      const parsedUrl = new URL(referenceImageUrl);
      if (!["http:", "https:", "data:"].includes(parsedUrl.protocol)) {
        return { ok: false, message: "参考图地址格式不正确。" };
      }
    } catch {
      return { ok: false, message: "参考图地址格式不正确。" };
    }
  }

  return {
    ok: true,
    data: {
      prompt,
      size: size as ImageSize,
      resolution: resolution as ImageResolution,
      quality: quality as ImageQuality,
      n,
    },
    apiConfig: apiConfig.data,
    referenceImageUrl,
  };
}

export function validateImageFile(input: unknown):
  | { ok: true; file: File }
  | { ok: false; message: string } {
  if (!(input instanceof File)) {
    return { ok: false, message: "请上传参考图片。" };
  }

  if (!["image/png", "image/jpeg", "image/webp"].includes(input.type)) {
    return { ok: false, message: "参考图片仅支持 PNG、JPG 或 WEBP。" };
  }

  const maxSize = 10 * 1024 * 1024;
  if (input.size > maxSize) {
    return { ok: false, message: "参考图片不能超过 10MB。" };
  }

  return { ok: true, file: input };
}

function parseApiConfig(input: unknown):
  | { ok: true; data?: Partial<ImageApiConfig> }
  | { ok: false; message: string } {
  if (!input) {
    return { ok: true };
  }

  if (typeof input !== "object") {
    return { ok: false, message: "API 设置格式不正确。" };
  }

  const config = input as Record<string, unknown>;
  const apiUrl = typeof config.apiUrl === "string" ? config.apiUrl.trim() : "";
  const apiKey = typeof config.apiKey === "string" ? config.apiKey.trim() : "";
  const model = typeof config.model === "string" ? config.model.trim() : "";

  if (apiUrl) {
    const validated = validateApiBaseUrl(apiUrl);
    if (!validated.ok) {
      return validated;
    }
  }

  if (apiKey && !isAsciiHeaderValue(apiKey)) {
    return { ok: false, message: "API Key 不能包含中文、全角字符或换行，请在设置里填入真实的英文/数字密钥。" };
  }

  if (apiKey.length > 10000 || model.length > 200 || apiUrl.length > 2000) {
    return { ok: false, message: "API 设置内容过长。" };
  }

  return {
    ok: true,
    data: {
      ...(apiUrl ? { apiUrl } : {}),
      ...(apiKey ? { apiKey } : {}),
      ...(model ? { model } : {}),
    },
  };
}

function isAsciiHeaderValue(value: string) {
  return /^[\x20-\x7E]+$/.test(value);
}
