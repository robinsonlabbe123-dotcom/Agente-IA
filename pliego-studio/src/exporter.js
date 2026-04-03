import { EXPORT_DPI } from "./config.js";
import { cmToPixels, downloadBlob, nextTick } from "./utils.js";

function cloneObject(obj) {
  return new Promise((resolve) => obj.clone((cloned) => resolve(cloned)));
}

function cleanupAlpha(dataUrl) {
  const image = new Image();
  return new Promise((resolve, reject) => {
    image.onload = () => {
      const c = document.createElement("canvas");
      c.width = image.width;
      c.height = image.height;
      const ctx = c.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(image, 0, 0);
      const imageData = ctx.getImageData(0, 0, c.width, c.height);
      const data = imageData.data;
      for (let i = 3; i < data.length; i += 4) {
        data[i] = data[i] < 128 ? 0 : 255;
      }
      ctx.putImageData(imageData, 0, 0);
      resolve(c.toDataURL("image/png"));
    };
    image.onerror = () => reject(new Error("No se pudo limpiar el canal alpha."));
    image.src = dataUrl;
  });
}

async function buildExportCanvas({ canvasManager, sheetCm, background, progress }) {
  const widthPx = Math.round(cmToPixels(sheetCm.width, EXPORT_DPI));
  const heightPx = Math.round(cmToPixels(sheetCm.height, EXPORT_DPI));
  const exportCanvas = new fabric.StaticCanvas(null, { width: widthPx, height: heightPx });

  if (background !== "transparent") {
    exportCanvas.backgroundColor = background;
  }

  const ratioX = widthPx / canvasManager.sheetSizePx.width;
  const ratioY = heightPx / canvasManager.sheetSizePx.height;
  const objects = canvasManager.getWorkspaceObjects();

  for (let i = 0; i < objects.length; i += 1) {
    progress(`Preparando objeto ${i + 1}/${objects.length}...`);
    const cloned = await cloneObject(objects[i]);
    cloned.set({
      left: cloned.left * ratioX,
      top: cloned.top * ratioY,
      scaleX: cloned.scaleX * ratioX,
      scaleY: cloned.scaleY * ratioY,
      strokeWidth: 0,
    });
    exportCanvas.add(cloned);
    await nextTick();
  }

  exportCanvas.renderAll();
  return exportCanvas;
}

export async function exportPNG({ canvasManager, sheetCm, background, flattenAlpha, progress }) {
  progress("Inicializando exportación PNG...");
  const exportCanvas = await buildExportCanvas({ canvasManager, sheetCm, background, progress });
  let dataUrl = exportCanvas.toDataURL({ format: "png", multiplier: 1 });

  if (flattenAlpha) {
    progress("Limpiando semitransparencias...");
    dataUrl = await cleanupAlpha(dataUrl);
  }

  const blob = await (await fetch(dataUrl)).blob();
  downloadBlob(blob, `pliego-${sheetCm.width}x${sheetCm.height}cm.png`);
  progress("PNG exportado correctamente.");
}

export async function exportPDF({ canvasManager, sheetCm, background, flattenAlpha, progress }) {
  progress("Generando imagen base para PDF...");
  const exportCanvas = await buildExportCanvas({ canvasManager, sheetCm, background, progress });
  let dataUrl = exportCanvas.toDataURL({ format: "png", multiplier: 1 });
  if (flattenAlpha) {
    progress("Limpiando semitransparencias...");
    dataUrl = await cleanupAlpha(dataUrl);
  }

  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({
    orientation: sheetCm.width > sheetCm.height ? "landscape" : "portrait",
    unit: "mm",
    format: [sheetCm.height * 10, sheetCm.width * 10],
    compress: true,
  });

  pdf.addImage(dataUrl, "PNG", 0, 0, sheetCm.width * 10, sheetCm.height * 10, undefined, "FAST");
  pdf.save(`pliego-${sheetCm.width}x${sheetCm.height}cm.pdf`);
  progress("PDF exportado correctamente.");
}
