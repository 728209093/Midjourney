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

export function downloadImage(src: string, filename: string) {
  const link = document.createElement("a");
  link.href = src;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
}
