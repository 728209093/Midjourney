import { NextRequest, NextResponse } from "next/server";

import { editImages, generateImages } from "@/lib/image-api";
import { validateGenerateRequest, validateImageFile } from "@/lib/validators";

const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS = 5;
const buckets = new Map<string, { count: number; resetAt: number }>();

function getClientIp(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  return request.headers.get("x-real-ip") || "unknown";
}

function isRateLimited(ip: string) {
  const now = Date.now();
  const bucket = buckets.get(ip);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }

  bucket.count += 1;
  return bucket.count > MAX_REQUESTS;
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status });
}

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    if (isRateLimited(ip)) {
      return json({ success: false, message: "请求过于频繁，请稍后再试。" }, 429);
    }

    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      return await handleImageEdit(request);
    }

    const body = await request.json().catch(() => null);
    const parsed = validateGenerateRequest(body);

    if (!parsed.ok) {
      return json({ success: false, message: parsed.message }, 400);
    }

    const images = await generateImages(parsed.data, parsed.apiConfig);
    return json({ success: true, images }, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : "图片生成失败，请稍后重试。";
    return json({ success: false, message }, 500);
  }
}

async function handleImageEdit(request: NextRequest) {
  try {
    const formData = await request.formData().catch(() => null);

    if (!formData) {
      return json({ success: false, message: "图生图请求格式不正确。" }, 400);
    }

    const apiConfigRaw = formData.get("apiConfig");
    const apiConfig =
      typeof apiConfigRaw === "string" && apiConfigRaw ? parseApiConfig(apiConfigRaw) : undefined;

    if (apiConfigRaw && apiConfig === null) {
      return json({ success: false, message: "API 设置格式不正确。" }, 400);
    }

    const body = {
      prompt: formData.get("prompt"),
      size: formData.get("size"),
      resolution: formData.get("resolution"),
      quality: formData.get("quality"),
      n: Number(formData.get("n")),
      apiConfig,
      referenceImageUrl: formData.get("referenceImageUrl"),
    };

    const parsed = validateGenerateRequest(body);
    if (!parsed.ok) {
      return json({ success: false, message: parsed.message }, 400);
    }

    if (parsed.referenceImageUrl) {
      const images = await editImages(
        { ...parsed.data, referenceImageUrl: parsed.referenceImageUrl },
        parsed.apiConfig,
      );
      return json({ success: true, images }, 200);
    }

    const image = validateImageFile(formData.get("image"));
    if (!image.ok) {
      return json({ success: false, message: image.message }, 400);
    }

    const images = await editImages({ ...parsed.data, image: image.file }, parsed.apiConfig);
    return json({ success: true, images }, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : "图生图失败，请稍后重试。";
    return json({ success: false, message }, 500);
  }
}

function parseApiConfig(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}
