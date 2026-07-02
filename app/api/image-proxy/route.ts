import { NextRequest, NextResponse } from "next/server";

// Optional exception list for private/internal image hosts. Public CDN/storage
// image URLs are allowed so generated images can be downloaded normally.
function getAllowedHosts(): Set<string> {
  const base = new Set<string>();

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
  const filename = getAttachmentFilename(request.nextUrl.searchParams.get("filename"));
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
  if (isPrivateHost(parsed.hostname) && !allowedHosts.has(parsed.hostname)) {
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
      "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "no-store",
    },
  });
}

function getAttachmentFilename(value: string | null) {
  const fallback = "image.png";
  if (!value) return fallback;

  const sanitized = value
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/[\r\n]/g, "")
    .trim();

  return sanitized || fallback;
}

function isPrivateHost(hostname: string) {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) {
    return true;
  }
  if (host === "::1" || host === "[::1]" || host.startsWith("fe80:") || host.startsWith("fc") || host.startsWith("fd")) {
    return true;
  }

  const ipv4Match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!ipv4Match) {
    return false;
  }

  const octets = ipv4Match.slice(1).map(Number);
  const [first, second] = octets;
  if (octets.some((octet) => octet < 0 || octet > 255)) {
    return true;
  }

  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
}
