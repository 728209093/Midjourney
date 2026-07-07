import { NextRequest, NextResponse } from "next/server";

import { resolveImageModelsUrl, validateApiBaseUrl } from "@/lib/api-url";
import type { ImageApiConfig, ImageModelOption, ModelListResponse } from "@/types/image";

type ProviderModelPayload = {
  data?: Array<{
    id?: unknown;
    created?: unknown;
    owned_by?: unknown;
  }>;
};

function json(body: ModelListResponse, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as { apiConfig?: Partial<ImageApiConfig> } | null;
    const apiConfig = normalizeApiConfig(body?.apiConfig);
    const endpoint = resolveImageModelsUrl(apiConfig.apiUrl || process.env.IMAGE_API_URL);
    const apiKey = apiConfig.apiKey || process.env.IMAGE_API_KEY;

    if (!endpoint || !apiKey) {
      return json({ success: false, message: "请先填写 API URL 和 API Key。" }, 400);
    }

    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      cache: "no-store",
    });
    const responseText = await response.text();
    const payload = parseJson(responseText);

    if (!response.ok) {
      return json(
        {
          success: false,
          message: getProviderErrorMessage(payload) || `模型列表获取失败，状态码 ${response.status}。`,
        },
        response.status,
      );
    }

    const models = normalizeProviderModels(payload);
    return json({ success: true, models });
  } catch (error) {
    const message = error instanceof Error ? error.message : "模型列表获取失败，请稍后重试。";
    return json({ success: false, message }, 500);
  }
}

function normalizeApiConfig(config: Partial<ImageApiConfig> | undefined): Partial<ImageApiConfig> {
  const apiUrl = typeof config?.apiUrl === "string" ? config.apiUrl.trim() : "";
  const apiKey = typeof config?.apiKey === "string" ? config.apiKey.trim() : "";

  if (apiUrl) {
    const validated = validateApiBaseUrl(apiUrl);
    if (!validated.ok) {
      throw new Error(validated.message);
    }
  }

  if (apiKey && !/^[\x20-\x7E]+$/.test(apiKey)) {
    throw new Error("API Key 不能包含中文、全角字符或换行。");
  }

  return {
    ...(apiUrl ? { apiUrl } : {}),
    ...(apiKey ? { apiKey } : {}),
  };
}

function parseJson(text: string): unknown {
  if (!text.trim()) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function normalizeProviderModels(payload: unknown): ImageModelOption[] {
  const data = Array.isArray((payload as ProviderModelPayload | null)?.data)
    ? (payload as ProviderModelPayload).data
    : Array.isArray(payload)
      ? (payload as ProviderModelPayload["data"])
      : [];

  const seen = new Set<string>();
  return (data || []).reduce<ImageModelOption[]>((models, item) => {
    const id = typeof item?.id === "string" ? item.id.trim() : "";
    if (!id || seen.has(id)) {
      return models;
    }

    seen.add(id);
    models.push({
      id,
      ...(typeof item.created === "number" ? { created: item.created } : {}),
      ...(typeof item.owned_by === "string" ? { ownedBy: item.owned_by } : {}),
    });
    return models;
  }, []);
}

function getProviderErrorMessage(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  const value = payload as { error?: { message?: unknown } | string; message?: unknown; detail?: unknown };
  if (typeof value.error === "string") return value.error;
  if (typeof value.error?.message === "string") return value.error.message;
  if (typeof value.message === "string") return value.message;
  if (typeof value.detail === "string") return value.detail;
  return "";
}
