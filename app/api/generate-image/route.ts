import { NextRequest, NextResponse } from "next/server";

import { editImages, generateImages } from "@/lib/image-api";
import { validateGenerateRequest, validateImageFile } from "@/lib/validators";

const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS = 5;
const MAX_REFERENCE_IMAGES = 8;
const buckets = new Map<string, { count: number; resetAt: number }>();

function createRequestId() {
  return `img_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

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

function json(body: unknown, status = 200, requestId?: string) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
      ...(requestId ? { "X-Request-Id": requestId } : {}),
    },
  });
}

export async function POST(request: NextRequest) {
  const requestId = createRequestId();
  const ip = getClientIp(request);
  const contentType = request.headers.get("content-type") || "";

  console.info(`[generate-image:${requestId}] start`, {
    ip,
    contentType,
    hasMultipart: contentType.includes("multipart/form-data"),
  });

  try {
    if (isRateLimited(ip)) {
      console.warn(`[generate-image:${requestId}] rate limited`, { ip });
      return json({ success: false, message: "请求过于频繁，请稍后再试。" }, 429, requestId);
    }

    if (contentType.includes("multipart/form-data")) {
      return await handleImageEdit(request, requestId);
    }

    const body = await request.json().catch(() => null);
    const parsed = validateGenerateRequest(body);

    if (!parsed.ok) {
      console.warn(`[generate-image:${requestId}] validation failed`, {
        message: parsed.message,
      });
      return json({ success: false, message: parsed.message }, 400, requestId);
    }

    const images = await generateImages(parsed.data, parsed.apiConfig);
    console.info(`[generate-image:${requestId}] success`, {
      mode: "generate",
      imageCount: images.length,
    });
    return json({ success: true, images }, 200, requestId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "图片生成失败，请稍后重试。";
    console.error(`[generate-image:${requestId}] failed`, {
      message,
      error: serializeError(error),
    });
    return json({ success: false, message }, 500, requestId);
  }
}

async function handleImageEdit(request: NextRequest, requestId: string) {
  try {
    const formData = await request.formData().catch(() => null);

    if (!formData) {
      return json({ success: false, message: "图生图请求格式不正确。" }, 400, requestId);
    }

    const apiConfigRaw = formData.get("apiConfig");
    const apiConfig =
      typeof apiConfigRaw === "string" && apiConfigRaw ? parseApiConfig(apiConfigRaw) : undefined;

    if (apiConfigRaw && apiConfig === null) {
      return json({ success: false, message: "API 设置格式不正确。" }, 400, requestId);
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
      console.warn(`[generate-image:${requestId}] validation failed`, {
        message: parsed.message,
      });
      return json({ success: false, message: parsed.message }, 400, requestId);
    }

    const imageInputs = formData.getAll("image");
    if (imageInputs.length > MAX_REFERENCE_IMAGES) {
      return json({ success: false, message: `最多支持 ${MAX_REFERENCE_IMAGES} 张参考图。` }, 400, requestId);
    }

    if (imageInputs.length > 0) {
      const imageResults = imageInputs.map(validateImageFile);
      const invalidImage = imageResults.find((image) => !image.ok);
      if (invalidImage && !invalidImage.ok) {
        return json({ success: false, message: invalidImage.message }, 400, requestId);
      }

      const uploadedImages = imageResults.map((image) => (image.ok ? image.file : null)).filter((image): image is File => Boolean(image));
      const images = await editImages({ ...parsed.data, images: uploadedImages }, parsed.apiConfig);
      console.info(`[generate-image:${requestId}] success`, {
        mode: "edit",
        imageCount: images.length,
        referenceImageCount: uploadedImages.length,
        via: "uploaded-file",
      });
      return json({ success: true, images }, 200, requestId);
    }

    if (parsed.referenceImageUrl) {
      const images = await editImages(
        { ...parsed.data, referenceImageUrl: parsed.referenceImageUrl },
        parsed.apiConfig,
      );
      console.info(`[generate-image:${requestId}] success`, {
        mode: "edit",
        imageCount: images.length,
        via: "referenceImageUrl",
      });
      return json({ success: true, images }, 200, requestId);
    }

    return json({ success: false, message: "请上传参考图。" }, 400, requestId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "图生图失败，请稍后重试。";
    console.error(`[generate-image:${requestId}] edit failed`, {
      message,
      error: serializeError(error),
    });
    return json({ success: false, message }, 500, requestId);
  }
}

function parseApiConfig(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function serializeError(error: unknown) {
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
