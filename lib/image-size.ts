import type { ImageAspectRatio, ImageSize } from "@/types/image";

type ImageSizeOption = {
  ratio: ImageAspectRatio;
  label: string;
  size: ImageSize;
};

export const IMAGE_ASPECT_RATIO_OPTIONS: ImageSizeOption[] = [
  { ratio: "1:1", label: "1:1", size: "1024x1024" },
  { ratio: "16:9", label: "16:9", size: "1536x864" },
  { ratio: "9:16", label: "9:16", size: "864x1536" },
  { ratio: "3:2", label: "3:2", size: "1536x1024" },
  { ratio: "2:3", label: "2:3", size: "1024x1536" },
  { ratio: "4:3", label: "4:3", size: "1408x1056" },
  { ratio: "3:4", label: "3:4", size: "1056x1408" },
  { ratio: "21:9", label: "21:9", size: "1536x656" },
];

const IMAGE_SIZE_BY_RATIO = new Map<ImageAspectRatio, ImageSize>(
  IMAGE_ASPECT_RATIO_OPTIONS.map((option) => [option.ratio, option.size]),
);

const IMAGE_RATIO_BY_SIZE = new Map<ImageSize, ImageAspectRatio>(
  IMAGE_ASPECT_RATIO_OPTIONS.map((option) => [option.size, option.ratio]),
);

export function getImageSizeForAspectRatio(ratio: ImageAspectRatio) {
  return IMAGE_SIZE_BY_RATIO.get(ratio) || "1024x1024";
}

export function inferAspectRatioFromSize(size: string) {
  const parsed = parseImageSize(size);
  if (!parsed) {
    return null;
  }

  const exactMatch = IMAGE_RATIO_BY_SIZE.get(parsed.size);
  if (exactMatch) {
    return exactMatch;
  }

  const aspect = parsed.width / parsed.height;
  let closest: { ratio: ImageAspectRatio; distance: number } | null = null;

  for (const option of IMAGE_ASPECT_RATIO_OPTIONS) {
    const [widthPart, heightPart] = option.ratio.split(":");
    const ratioValue = Number(widthPart) / Number(heightPart);
    const distance = Math.abs(ratioValue - aspect);

    if (!closest || distance < closest.distance) {
      closest = { ratio: option.ratio, distance };
    }
  }

  return closest?.ratio || null;
}

export function parseImageSize(value: string) {
  const normalized = value.trim().toLowerCase();
  const match = /^(\d+)x(\d+)$/.exec(normalized);
  if (!match) {
    return null;
  }

  const width = Number(match[1]);
  const height = Number(match[2]);

  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    return null;
  }

  return {
    width,
    height,
    size: `${width}x${height}` as ImageSize,
  };
}

export function normalizeImageSize(value: string) {
  const parsed = parseImageSize(value);
  if (!parsed) {
    return null;
  }

  if (parsed.width % 16 !== 0 || parsed.height % 16 !== 0) {
    return null;
  }

  const aspect = parsed.width / parsed.height;
  if (aspect < 1 / 3 || aspect > 3) {
    return null;
  }

  return parsed.size;
}

export function formatImageSize(size: string) {
  return size.replace("x", " × ");
}
