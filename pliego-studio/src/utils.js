export const CM_PER_INCH = 2.54;

export function cmToPixels(cm, dpi) {
  return (cm / CM_PER_INCH) * dpi;
}

export function pixelsToCm(px, pixelsPerCm) {
  return px / pixelsPerCm;
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function formatCm(value) {
  return `${value.toFixed(1)} cm`;
}

export function fileExtension(filename) {
  const parts = filename.toLowerCase().split(".");
  return parts.length > 1 ? parts.pop() : "";
}

export function downloadBlob(blob, filename) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

export function nextTick() {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}
