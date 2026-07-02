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

export async function copyTextToClipboard(text: string) {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  const copied = document.execCommand("copy");
  textarea.remove();

  if (!copied) {
    throw new Error("Copy failed");
  }
}

export function downloadImage(src: string, filename: string) {
  if (!src) {
    throw new Error("Missing image source");
  }

  if (/^https?:\/\//.test(src)) {
    const params = new URLSearchParams({
      url: src,
      filename,
    });
    triggerDownload(`/api/image-proxy?${params.toString()}`, filename);
    return;
  }

  triggerDownload(src, filename);
}

function triggerDownload(href: string, filename: string) {
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  link.rel = "noopener";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

