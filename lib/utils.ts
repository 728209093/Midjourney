import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function createId(prefix = "img") {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }

  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function getImageSrc(image: { url?: string; base64?: string }) {
  if (image.url) {
    return image.url;
  }

  if (image.base64) {
    return image.base64.startsWith("data:")
      ? image.base64
      : `data:image/png;base64,${image.base64}`;
  }

  return "";
}

export async function downloadImage(src: string, filename: string) {
  if (typeof navigator !== "undefined" && "share" in navigator && "canShare" in navigator) {
    try {
      const response = await fetchDownloadSource(src);
      const blob = await response.blob();
      const file = new File([blob], filename, { type: blob.type || "image/png" });
      const shareData: ShareData = { files: [file], title: filename };

      if (navigator.canShare(shareData)) {
        await navigator.share(shareData);
        return;
      }
    } catch {
      // Fall back to the standard download link below.
    }
  }

  const link = document.createElement("a");
  link.href = src;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

async function fetchDownloadSource(src: string) {
  try {
    const response = await fetch(src);
    if (response.ok) {
      return response;
    }
  } catch {
    // Try the same-origin image proxy for remote images below.
  }

  if (/^https?:\/\//.test(src)) {
    const response = await fetch(`/api/image-proxy?url=${encodeURIComponent(src)}`);
    if (response.ok) {
      return response;
    }
  }

  throw new Error("Image download failed");
}
