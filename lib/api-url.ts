const IMAGE_GENERATION_PATH = "/v1/images/generations";
const IMAGE_EDIT_PATH = "/v1/images/edits";
const IMAGE_MODELS_PATH = "/v1/models";

export function validateApiBaseUrl(value: string):
  | { ok: true; baseUrl: string }
  | { ok: false; message: string } {
  const trimmed = value.trim();

  if (!trimmed) {
    return { ok: true, baseUrl: "" };
  }

  if (trimmed.endsWith("/")) {
    return { ok: false, message: "API URL 请填写根域名，不要以 / 结尾。" };
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { ok: false, message: "API URL 格式不正确，请填写类似 https://dahlo.live 的地址。" };
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    return { ok: false, message: "API URL 只支持 http 或 https。" };
  }

  if (url.pathname.toLowerCase() === "/v1" || url.pathname.toLowerCase().endsWith("/v1")) {
    return { ok: false, message: "API URL 请填写根域名，不要携带 /v1。" };
  }

  if (url.pathname !== "" && url.pathname !== "/") {
    return { ok: false, message: "API URL 请填写根域名，不要携带接口路径。" };
  }

  url.search = "";
  url.hash = "";

  return { ok: true, baseUrl: url.toString().replace(/\/$/, "") };
}

export function resolveImageGenerationUrl(baseUrl?: string) {
  return resolveImageEndpointUrl(baseUrl, IMAGE_GENERATION_PATH);
}

export function resolveImageEditUrl(baseUrl?: string) {
  return resolveImageEndpointUrl(baseUrl, IMAGE_EDIT_PATH);
}

export function resolveImageModelsUrl(baseUrl?: string) {
  return resolveImageEndpointUrl(baseUrl, IMAGE_MODELS_PATH);
}

export function resolveGeminiGenerateContentUrl(baseUrl: string | undefined, model: string) {
  return resolveImageEndpointUrl(baseUrl, `/v1beta/models/${encodeURIComponent(model)}:generateContent`);
}

function resolveImageEndpointUrl(baseUrl: string | undefined, path: string) {
  if (!baseUrl) {
    return baseUrl;
  }

  const validated = validateApiBaseUrl(baseUrl);

  if (!validated.ok) {
    throw new Error(validated.message);
  }

  return `${validated.baseUrl}${path}`;
}
