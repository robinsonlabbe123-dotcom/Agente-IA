import { ALLOWED_EXTENSIONS, DEFAULT_SHEET_CM } from "./config.js";
import { computeAutoLayout } from "./autoLayout.js";
import { CanvasManager } from "./canvasManager.js";
import { exportPDF, exportPNG } from "./exporter.js";
import { state } from "./state.js";
import { fileExtension, formatCm } from "./utils.js";

const ui = {
  sheetWidthCm: document.getElementById("sheetWidthCm"),
  sheetHeightCm: document.getElementById("sheetHeightCm"),
  applySheet: document.getElementById("applySheet"),
  sheetSummary: document.getElementById("sheetSummary"),
  projectStatus: document.getElementById("projectStatus"),
  fileInput: document.getElementById("fileInput"),
  dropzone: document.getElementById("dropzone"),
  fileFeedback: document.getElementById("fileFeedback"),
  selectionInfo: document.getElementById("selectionInfo"),
  duplicateBtn: document.getElementById("duplicateBtn"),
  deleteBtn: document.getElementById("deleteBtn"),
  bringFrontBtn: document.getElementById("bringFrontBtn"),
  sendBackBtn: document.getElementById("sendBackBtn"),
  rotateLeftBtn: document.getElementById("rotateLeftBtn"),
  rotateRightBtn: document.getElementById("rotateRightBtn"),
  safetyMargin: document.getElementById("safetyMargin"),
  autoLayoutBtn: document.getElementById("autoLayoutBtn"),
  layoutFeedback: document.getElementById("layoutFeedback"),
  backgroundSelector: document.getElementById("backgroundSelector"),
  flattenAlpha: document.getElementById("flattenAlpha"),
  exportPngBtn: document.getElementById("exportPngBtn"),
  exportPdfBtn: document.getElementById("exportPdfBtn"),
  quickPng: document.getElementById("quickPng"),
  quickPdf: document.getElementById("quickPdf"),
  exportFeedback: document.getElementById("exportFeedback"),
  zoomOut: document.getElementById("zoomOut"),
  zoomIn: document.getElementById("zoomIn"),
  resetView: document.getElementById("resetView"),
  centerView: document.getElementById("centerView"),
  zoomLabel: document.getElementById("zoomLabel"),
};

const canvasManager = new CanvasManager("editorCanvas", "canvasContainer");
canvasManager.setSheetSizeCm(DEFAULT_SHEET_CM.width, DEFAULT_SHEET_CM.height);

function setStatus(message) {
  ui.projectStatus.textContent = message;
}

function syncSheetSummary() {
  ui.sheetSummary.textContent = `${state.sheetCm.width} × ${state.sheetCm.height} cm`;
}

function updateZoomLabel() {
  ui.zoomLabel.textContent = `${Math.round(canvasManager.canvas.getZoom() * 100)}%`;
}

function updateSelectionInfo(metrics) {
  if (!metrics) {
    ui.selectionInfo.textContent = "Selecciona un objeto para editar.";
    return;
  }
  ui.selectionInfo.textContent = `W: ${formatCm(metrics.widthCm)} · H: ${formatCm(metrics.heightCm)} · Rot: ${Math.round(metrics.angle)}°`;
}

canvasManager.onSelectionChange = updateSelectionInfo;

function applySheetSize() {
  const width = Number(ui.sheetWidthCm.value);
  const height = Number(ui.sheetHeightCm.value);
  if (!width || !height || width < 10 || height < 10) {
    setStatus("Dimensiones inválidas.");
    return;
  }

  state.sheetCm.width = width;
  state.sheetCm.height = height;
  canvasManager.setSheetSizeCm(width, height);
  syncSheetSummary();
  setStatus("Pliego actualizado.");
  updateZoomLabel();
}

ui.applySheet.addEventListener("click", applySheetSize);

async function handleFiles(fileList) {
  const files = Array.from(fileList);
  if (!files.length) return;

  let added = 0;
  for (const file of files) {
    const ext = fileExtension(file.name);
    if (!ALLOWED_EXTENSIONS.includes(ext)) continue;
    try {
      await canvasManager.addFile(file);
      added += 1;
    } catch (error) {
      console.error(error);
    }
  }

  ui.fileFeedback.textContent = `${added} archivo(s) cargado(s).`;
  setStatus(added ? "Diseños cargados." : "No se cargaron archivos válidos.");
}

ui.fileInput.addEventListener("change", (event) => handleFiles(event.target.files));

ui.dropzone.addEventListener("dragover", (e) => {
  e.preventDefault();
  ui.dropzone.classList.add("drag-over");
});
ui.dropzone.addEventListener("dragleave", () => ui.dropzone.classList.remove("drag-over"));
ui.dropzone.addEventListener("drop", (e) => {
  e.preventDefault();
  ui.dropzone.classList.remove("drag-over");
  handleFiles(e.dataTransfer.files);
});

ui.duplicateBtn.addEventListener("click", () => canvasManager.duplicateSelection());
ui.deleteBtn.addEventListener("click", () => canvasManager.deleteSelection());
ui.bringFrontBtn.addEventListener("click", () => canvasManager.bringForward());
ui.sendBackBtn.addEventListener("click", () => canvasManager.sendBackward());
ui.rotateLeftBtn.addEventListener("click", () => canvasManager.rotateSelection(-15));
ui.rotateRightBtn.addEventListener("click", () => canvasManager.rotateSelection(15));

ui.autoLayoutBtn.addEventListener("click", () => {
  const objects = canvasManager.getWorkspaceObjects();
  const marginCm = Number(ui.safetyMargin.value || 0.5);
  const marginPx = marginCm * canvasManager.pixelsPerCm;

  const payload = objects.map((obj, index) => ({
    id: index,
    ref: obj,
    w: obj.getScaledWidth(),
    h: obj.getScaledHeight(),
  }));

  const result = computeAutoLayout({
    objects: payload.map(({ id, w, h }) => ({ id, w, h })),
    sheetWidth: canvasManager.sheetSizePx.width,
    sheetHeight: canvasManager.sheetSizePx.height,
    margin: marginPx,
  });

  if (!result.ok) {
    ui.layoutFeedback.textContent = result.reason;
    return;
  }

  for (const placement of result.placements) {
    const item = payload.find((p) => p.id === placement.id);
    if (!item) continue;
    const obj = item.ref;

    const needsRotation = placement.angle === 90;
    const baseAngle = Math.round((obj.angle || 0) / 90) * 90;
    obj.set({
      angle: needsRotation ? baseAngle + 90 : baseAngle,
      left: placement.x,
      top: placement.y,
      originX: "left",
      originY: "top",
    });

    const ratio = placement.w / obj.getScaledWidth();
    obj.scaleX *= ratio;
    obj.scaleY *= ratio;
    obj.setCoords();
  }

  canvasManager.canvas.requestRenderAll();
  ui.layoutFeedback.textContent = `Distribución optimizada con escala x${result.scale.toFixed(2)}.`;
  setStatus("Auto-layout aplicado.");
});

ui.backgroundSelector.addEventListener("click", (e) => {
  const button = e.target.closest("button[data-bg]");
  if (!button) return;
  state.background = button.dataset.bg;
  for (const el of ui.backgroundSelector.querySelectorAll("button")) {
    el.classList.toggle("active", el === button);
  }
});

ui.flattenAlpha.addEventListener("change", () => {
  state.flattenAlpha = ui.flattenAlpha.checked;
});

async function runExport(type) {
  const payload = {
    canvasManager,
    sheetCm: state.sheetCm,
    background: state.background,
    flattenAlpha: state.flattenAlpha,
    progress: (msg) => {
      ui.exportFeedback.textContent = msg;
      setStatus(type === "png" ? "Exportando PNG..." : "Exportando PDF...");
    },
  };

  try {
    if (type === "png") await exportPNG(payload);
    else await exportPDF(payload);
    setStatus("Exportación finalizada.");
  } catch (error) {
    console.error(error);
    ui.exportFeedback.textContent = `Error: ${error.message}`;
    setStatus("Error al exportar.");
  }
}

ui.exportPngBtn.addEventListener("click", () => runExport("png"));
ui.exportPdfBtn.addEventListener("click", () => runExport("pdf"));
ui.quickPng.addEventListener("click", () => runExport("png"));
ui.quickPdf.addEventListener("click", () => runExport("pdf"));

ui.zoomIn.addEventListener("click", () => {
  canvasManager.setZoom(canvasManager.canvas.getZoom() * 1.15);
  updateZoomLabel();
});
ui.zoomOut.addEventListener("click", () => {
  canvasManager.setZoom(canvasManager.canvas.getZoom() / 1.15);
  updateZoomLabel();
});
ui.resetView.addEventListener("click", () => {
  canvasManager.setZoom(1);
  updateZoomLabel();
});
ui.centerView.addEventListener("click", () => {
  canvasManager.centerSheet();
  updateZoomLabel();
});

canvasManager.canvas.on("mouse:wheel", updateZoomLabel);
syncSheetSummary();
updateZoomLabel();
setStatus("Listo");
