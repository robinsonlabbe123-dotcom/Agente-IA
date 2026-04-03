# Pliego Studio (MVP)

Herramienta web profesional para armado de pliegos de impresión (DTF/sublimación) con edición visual, auto-layout y exportación en PNG/PDF.

## Ejecutar localmente

```bash
cd pliego-studio
python -m http.server 5173
# abrir http://localhost:5173
```

> También se puede servir con cualquier static server.

## Funcionalidades incluidas

- Configuración del pliego en centímetros (por defecto 58x100).
- Canvas de edición con objetos seleccionables, escala, rotación, movimiento.
- Carga múltiple de PNG/JPG/JPEG/WEBP/SVG (input + drag & drop).
- Acciones de objeto: duplicar, eliminar, reordenar, rotar.
- Medidas aproximadas por objeto en centímetros.
- Auto-acomodado por heurística shelf packing con rotación 90° y ajuste de escala.
- Fondo de exportación: transparente, blanco o negro.
- Limpieza opcional de semitransparencias (alpha 0/255).
- Exportación PNG y PDF a 300 DPI con tamaño real del pliego.
- Zoom, reset, centrar, pan (barra espaciadora + arrastre).
- Diseño responsive desktop-first con uso móvil funcional.

## Estructura

```
pliego-studio/
├── index.html
├── styles.css
└── src/
    ├── app.js
    ├── autoLayout.js
    ├── canvasManager.js
    ├── config.js
    ├── exporter.js
    ├── state.js
    └── utils.js
```
