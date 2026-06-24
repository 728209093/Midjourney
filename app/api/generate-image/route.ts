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

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);

  if (isRateLimited(ip)) {
    return NextResponse.json(
      { success: false, message: "请求过于频繁，请稍后再试。" },
      { status: 429 },
    );
  }

  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    return handleImageEdit(request);
  }

  const body = await request.json().catch(() => null);
  const parsed = validateGenerateRequest(body);

  if (!parsed.ok) {
    return NextResponse.json({ success: false, message: parsed.message }, { status: 400 });
  }

  try {
    const images = await generateImages(parsed.data, parsed.apiConfig);
    return NextResponse.json({ success: true, images });
  } catch (error) {
    const message = error instanceof Error ? error.message : "图片生成失败，请稍后重试。";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

async function handleImageEdit(request: NextRequest) {
  const formData = await request.formData().catch(() => null);

  if (!formData) {
    return NextResponse.json({ success: false, message: "图生图请求格式不正确。" }, { status: 400 });
  }

  const apiConfigRaw = formData.get("apiConfig");
  const apiConfig =
    typeof apiConfigRaw === "string" && apiConfigRaw
      ? parseApiConfig(apiConfigRaw)
      : undefined;

  if (apiConfigRaw && apiConfig === null) {
    return NextResponse.json({ success: false, message: "API 设置格式不正确。" }, { status: 400 });
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
    return NextResponse.json({ success: false, message: parsed.message }, { status: 400 });
  }

  try {
    if (parsed.referenceImageUrl) {
      const images = await editImages(
        { ...parsed.data, referenceImageUrl: parsed.referenceImageUrl },
        parsed.apiConfig,
      );
      return NextResponse.json({ success: true, images });
    }

    const image = validateImageFile(formData.get("image"));
    if (!image.ok) {
      return NextResponse.json({ success: false, message: image.message }, { status: 400 });
    }

    const images = await editImages({ ...parsed.data, image: image.file }, parsed.apiConfig);
    return NextResponse.json({ success: true, images });
  } catch (error) {
    const message = error instanceof Error ? error.message : "图生图失败，请稍后重试。";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

function parseApiConfig(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}
