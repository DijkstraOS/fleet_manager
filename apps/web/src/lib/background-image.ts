export interface ImageNaturalSize {
  width: number;
  height: number;
}

export type BackgroundImageMediaType = "image/png" | "image/jpeg" | "image/webp" | "image/svg+xml";

export interface ReadBackgroundImage {
  src: string;
  fileName: string;
  mediaType: BackgroundImageMediaType;
  naturalWidth: number;
  naturalHeight: number;
}

const FALLBACK_SVG_SIZE: ImageNaturalSize = { width: 100, height: 100 };

export async function readBackgroundImageFile(file: File): Promise<ReadBackgroundImage> {
  const mediaType = inferBackgroundImageMediaType(file);
  if (!mediaType) throw new Error("Choose a PNG, JPEG, WebP, or SVG background image.");

  if (mediaType === "image/svg+xml") {
    const svg = await file.text();
    validateSvg(svg);
    const naturalSize = readSvgNaturalSize(svg);
    return {
      src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
      fileName: file.name || "background.svg",
      mediaType,
      naturalWidth: naturalSize.width,
      naturalHeight: naturalSize.height,
    };
  }

  const [src, naturalSize] = await Promise.all([
    readDataUrl(file),
    readRasterNaturalSize(file),
  ]);
  return {
    src,
    fileName: file.name || "background",
    mediaType,
    naturalWidth: naturalSize.width,
    naturalHeight: naturalSize.height,
  };
}

async function readRasterNaturalSize(file: File): Promise<ImageNaturalSize> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Could not read background image dimensions."));
      image.src = url;
    });
    return {
      width: image.naturalWidth || FALLBACK_SVG_SIZE.width,
      height: image.naturalHeight || FALLBACK_SVG_SIZE.height,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function readSvgNaturalSize(svg: string): ImageNaturalSize {
  const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
  const parseError = doc.querySelector("parsererror");
  const root = doc.documentElement;
  if (parseError || root.nodeName.toLowerCase() !== "svg") return FALLBACK_SVG_SIZE;

  const viewBox = root.getAttribute("viewBox");
  if (viewBox) {
    const parts = viewBox.split(/[\s,]+/).map(Number).filter(Number.isFinite);
    const width = parts[2];
    const height = parts[3];
    if (width && height && width > 0 && height > 0) return { width, height };
  }

  const width = parseSvgLength(root.getAttribute("width"));
  const height = parseSvgLength(root.getAttribute("height"));
  if (width && height && width > 0 && height > 0) return { width, height };

  return FALLBACK_SVG_SIZE;
}

function parseSvgLength(value: string | null) {
  if (!value) return null;
  const match = value.trim().match(/^([0-9]+(?:\.[0-9]+)?)/);
  return match ? Number(match[1]) : null;
}

function readDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Could not read background image."));
    };
    reader.onerror = () => reject(new Error("Could not read background image."));
    reader.readAsDataURL(file);
  });
}

function inferBackgroundImageMediaType(file: File): BackgroundImageMediaType | null {
  if (file.type === "image/png" || file.type === "image/jpeg" || file.type === "image/webp" || file.type === "image/svg+xml") {
    return file.type;
  }
  const extension = file.name.toLowerCase().split(".").pop();
  switch (extension) {
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    case "svg":
      return "image/svg+xml";
    default:
      return null;
  }
}

function validateSvg(svg: string) {
  const hasSvgRoot = /^\s*(?:<\?xml[^>]*>\s*)?(?:<!--[\s\S]*?-->\s*)*<svg[\s>]/i.test(svg);
  const hasSvgEnd = /<\/svg>\s*$/i.test(svg) || /^\s*(?:<\?xml[^>]*>\s*)?(?:<!--[\s\S]*?-->\s*)*<svg[\s\S]*\/>\s*$/i.test(svg);
  if (!hasSvgRoot || !hasSvgEnd) throw new Error("Malformed SVG background image.");
  if (/<script[\s>]/i.test(svg)) throw new Error("SVG background image cannot contain scripts.");
  if (/<foreignObject[\s>]/i.test(svg)) throw new Error("SVG background image cannot contain foreignObject.");
  if (/\son[a-z]+\s*=/i.test(svg)) throw new Error("SVG background image cannot contain event handlers.");
  if (/<!(?:doctype|entity)\b/i.test(svg)) throw new Error("SVG background image cannot contain document type declarations.");
  if (/(?:href|xlink:href)\s*=\s*["']\s*(?:https?:|data:|javascript:|\/\/)/i.test(svg)) {
    throw new Error("SVG background image cannot reference external or executable resources.");
  }
  if (/url\(\s*["']?\s*(?:https?:|data:|javascript:|\/\/)/i.test(svg)) {
    throw new Error("SVG background image cannot reference external or executable resources.");
  }
}
