import { EDIT_MAX_PREVIEW_PX, MAX_ZOOM, MIN_ZOOM } from "./config.js";
import { clamp, fileExtension, pixelsToCm } from "./utils.js";

export class CanvasManager {
  constructor(canvasId, containerId) {
    this.container = document.getElementById(containerId);
    this.canvas = new fabric.Canvas(canvasId, {
      preserveObjectStacking: true,
      stopContextMenu: true,
      selection: true,
      backgroundColor: "#151922",
    });
    this.sheetRect = null;
    this.sheetSizePx = { width: 0, height: 0 };
    this.pixelsPerCm = 10;
    this.isPanning = false;
    this.onSelectionChange = null;
    this.initViewport();
    this.bindEvents();
  }

  initViewport() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.canvas.setDimensions({ width, height });
  }

  setSheetSizeCm(widthCm, heightCm) {
    const maxDim = Math.max(widthCm, heightCm);
    this.pixelsPerCm = EDIT_MAX_PREVIEW_PX / maxDim;
    this.sheetSizePx = {
      width: Math.round(widthCm * this.pixelsPerCm),
      height: Math.round(heightCm * this.pixelsPerCm),
    };

    if (this.sheetRect) {
      this.canvas.remove(this.sheetRect);
    }

    this.sheetRect = new fabric.Rect({
      left: 0,
      top: 0,
      width: this.sheetSizePx.width,
      height: this.sheetSizePx.height,
      fill: "transparent",
      stroke: "#5c667d",
      strokeDashArray: [8, 6],
      selectable: false,
      evented: false,
      excludeFromExport: true,
    });

    this.canvas.clear();
    this.canvas.add(this.sheetRect);
    this.sheetRect.sendToBack();
    this.centerSheet();
    this.canvas.requestRenderAll();
  }

  centerSheet() {
    const zoom = this.canvas.getZoom();
    const vp = this.canvas.viewportTransform;
    vp[4] = (this.canvas.width - this.sheetSizePx.width * zoom) / 2;
    vp[5] = (this.canvas.height - this.sheetSizePx.height * zoom) / 2;
    this.canvas.requestRenderAll();
  }

  setZoom(nextZoom) {
    const zoom = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
    const center = this.canvas.getCenter();
    this.canvas.zoomToPoint(new fabric.Point(center.left, center.top), zoom);
    this.centerSheet();
    return zoom;
  }

  bindEvents() {
    window.addEventListener("resize", () => {
      this.initViewport();
      this.centerSheet();
    });

    let spacePressed = false;
    window.addEventListener("keydown", (event) => {
      if (event.code === "Space") {
        spacePressed = true;
        this.canvas.defaultCursor = "grab";
      }
      if ((event.key === "Delete" || event.key === "Backspace") && this.canvas.getActiveObject()) {
        event.preventDefault();
        this.deleteSelection();
      }
    });
    window.addEventListener("keyup", (event) => {
      if (event.code === "Space") {
        spacePressed = false;
        this.canvas.defaultCursor = "default";
      }
    });

    this.canvas.on("mouse:wheel", (opt) => {
      const delta = opt.e.deltaY;
      let zoom = this.canvas.getZoom();
      zoom *= 0.999 ** delta;
      zoom = clamp(zoom, MIN_ZOOM, MAX_ZOOM);
      this.canvas.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, zoom);
      opt.e.preventDefault();
      opt.e.stopPropagation();
    });

    this.canvas.on("mouse:down", (opt) => {
      if (spacePressed) {
        this.isPanning = true;
        this.canvas.selection = false;
        this.lastPosX = opt.e.clientX;
        this.lastPosY = opt.e.clientY;
      }
    });

    this.canvas.on("mouse:move", (opt) => {
      if (!this.isPanning) return;
      const vpt = this.canvas.viewportTransform;
      vpt[4] += opt.e.clientX - this.lastPosX;
      vpt[5] += opt.e.clientY - this.lastPosY;
      this.lastPosX = opt.e.clientX;
      this.lastPosY = opt.e.clientY;
      this.canvas.requestRenderAll();
    });

    this.canvas.on("mouse:up", () => {
      this.isPanning = false;
      this.canvas.selection = true;
    });

    const emitSelection = () => {
      if (this.onSelectionChange) {
        this.onSelectionChange(this.getSelectionMetrics());
      }
    };
    this.canvas.on("selection:created", emitSelection);
    this.canvas.on("selection:updated", emitSelection);
    this.canvas.on("selection:cleared", emitSelection);
    this.canvas.on("object:modified", emitSelection);
    this.canvas.on("object:scaling", emitSelection);
    this.canvas.on("object:rotating", emitSelection);
    this.canvas.on("object:moving", emitSelection);
  }

  getWorkspaceObjects() {
    return this.canvas.getObjects().filter((obj) => obj !== this.sheetRect);
  }

  async addFile(file) {
    const ext = fileExtension(file.name);
    const isSvg = ext === "svg";
    const dataUrl = await this.fileToDataUrl(file);
    const obj = isSvg
      ? await this.svgToFabricObject(dataUrl)
      : await this.imageToFabricObject(dataUrl);

    const maxAllowed = Math.min(this.sheetSizePx.width, this.sheetSizePx.height) * 0.35;
    const maxCurrent = Math.max(obj.width, obj.height);
    const scale = Math.min(1, maxAllowed / maxCurrent);
    obj.scale(scale);

    obj.left = this.sheetSizePx.width * 0.1 + Math.random() * this.sheetSizePx.width * 0.2;
    obj.top = this.sheetSizePx.height * 0.1 + Math.random() * this.sheetSizePx.height * 0.2;
    obj.set({
      cornerColor: "#3b82f6",
      borderColor: "#3b82f6",
      transparentCorners: false,
      lockUniScaling: false,
    });

    this.canvas.add(obj);
    obj.bringToFront();
    this.canvas.setActiveObject(obj);
    this.canvas.requestRenderAll();
  }

  fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error(`No se pudo leer ${file.name}`));
      reader.readAsDataURL(file);
    });
  }

  imageToFabricObject(dataUrl) {
    return new Promise((resolve, reject) => {
      fabric.Image.fromURL(dataUrl, (img) => {
        if (!img) reject(new Error("No se pudo crear la imagen."));
        else resolve(img);
      }, { crossOrigin: "anonymous" });
    });
  }

  svgToFabricObject(dataUrl) {
    return new Promise((resolve, reject) => {
      fabric.loadSVGFromURL(dataUrl, (objects, options) => {
        if (!objects || !objects.length) {
          reject(new Error("SVG inválido."));
          return;
        }
        const svgObj = fabric.util.groupSVGElements(objects, options);
        resolve(svgObj);
      });
    });
  }

  getSelectionMetrics() {
    const obj = this.canvas.getActiveObject();
    if (!obj) return null;
    const widthCm = pixelsToCm(obj.getScaledWidth(), this.pixelsPerCm);
    const heightCm = pixelsToCm(obj.getScaledHeight(), this.pixelsPerCm);
    return { widthCm, heightCm, angle: obj.angle || 0 };
  }

  duplicateSelection() {
    const active = this.canvas.getActiveObject();
    if (!active) return;
    active.clone((cloned) => {
      cloned.set({ left: active.left + 20, top: active.top + 20 });
      this.canvas.add(cloned);
      this.canvas.setActiveObject(cloned);
      this.canvas.requestRenderAll();
    });
  }

  deleteSelection() {
    const active = this.canvas.getActiveObject();
    if (!active) return;
    this.canvas.remove(active);
    this.canvas.discardActiveObject();
    this.canvas.requestRenderAll();
  }

  rotateSelection(delta) {
    const active = this.canvas.getActiveObject();
    if (!active) return;
    active.rotate((active.angle || 0) + delta);
    this.canvas.requestRenderAll();
  }

  bringForward() {
    const active = this.canvas.getActiveObject();
    if (!active) return;
    this.canvas.bringForward(active);
    this.canvas.requestRenderAll();
  }

  sendBackward() {
    const active = this.canvas.getActiveObject();
    if (!active) return;
    this.canvas.sendBackwards(active);
    if (this.sheetRect) this.sheetRect.sendToBack();
    this.canvas.requestRenderAll();
  }
}
