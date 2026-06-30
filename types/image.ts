export type ImageSize =
  | "1024x1024"
  | "1536x864"
  | "864x1536"
  | "1536x1024"
  | "1024x1536"
  | "1408x1056"
  | "1056x1408"
  | "1536x656";

export type ImageResolution = "1k" | "2k" | "4k";

export type ImageQuality = "low" | "medium" | "high";

export type ImageMode = "generate" | "edit";

export type ImageGenerateParams = {
  prompt: string;
  size: ImageSize;
  resolution: ImageResolution;
  quality: ImageQuality;
  n: number;
};

export type ImageEditParams = ImageGenerateParams & {
  image?: File;
  referenceImageUrl?: string;
};

export type ImageApiConfig = {
  apiUrl: string;
  apiKey: string;
  model: string;
};

export type GeneratedImage = {
  id: string;
  url?: string;
  base64?: string;
  prompt: string;
  mode?: ImageMode;
  size: ImageSize;
  resolution: ImageResolution;
  quality: ImageQuality;
  createdAt: string;
};

export type GenerateImageResponse =
  | {
      success: true;
      images: GeneratedImage[];
    }
  | {
      success: false;
      message: string;
    };
