import { NextRequest, NextResponse } from "next/server";

// 只允许代理来自图片 API 的域名，防止被用作开放代理（SSRF）
// 生产环境中可通过 IMAGE_PROXY_ALLOWED_HOSTS 环境变量追加允许的 host，逗号分隔
function getAllowedHosts(): Set<string> {
  const base = new Set<string>();

  const apiUrl = process.env.IMAGE_API_URL;
  if (apiUrl) {
    try {
      base.add(new URL(apiUrl).hostname);
    } catch {
      // ignore
    }
  }

  const extra = process.env.IMAGE_PROXY_ALLOWED_HOSTS;
  if (extra) {
    for (const host of extra.split(",")) {
      const trimmed = host.trim();
      if (trimmed) base.add(trimmed);
    }
  }

  return base;
}

export async function GET(request: NextRequest) {
  const target = request.nextUrl.searchParams.get("url");
  if (!target) {
    return NextResponse.json({ success: false, message: "Missing url" }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return NextResponse.json({ success: false, message: "Invalid url" }, { status: 400 });
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    return NextResponse.json({ success: false, message: "Unsupported url" }, { status: 400 });
  }

  // 如果配置了允许的 host 列表，则进行白名单校验
  const allowedHosts = getAllowedHosts();
  if (allowedHosts.size > 0 && !allowedHosts.has(parsed.hostname)) {
    return NextResponse.json({ success: false, message: "Host not allowed" }, { status: 403 });
  }

  const response = await fetch(parsed.toString(), {
    headers: {
      "user-agent": "Mozilla/5.0",
    },
  });

  if (!response.ok) {
    return NextResponse.json({ success: false, message: "Failed to fetch image" }, { status: 502 });
  }

  const contentType = response.headers.get("content-type") || "application/octet-stream";

  // 只允许代理图片类型，拒绝 HTML / JSON 等其他内容
  if (!contentType.startsWith("image/")) {
    return NextResponse.json({ success: false, message: "Not an image" }, { status: 415 });
  }

  const buffer = await response.arrayBuffer();

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "no-store",
    },
  });
}
