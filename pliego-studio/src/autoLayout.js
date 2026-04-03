function packShelves(items, width, height, margin) {
  const placements = [];
  let y = margin;
  let shelfHeight = 0;
  let x = margin;

  for (const item of items) {
    const candidates = [
      { w: item.w, h: item.h, angle: 0 },
      { w: item.h, h: item.w, angle: 90 },
    ];

    let chosen = null;

    for (const c of candidates) {
      if (x + c.w + margin <= width && y + c.h + margin <= height) {
        chosen = c;
        break;
      }
    }

    if (!chosen) {
      y += shelfHeight + margin;
      x = margin;
      shelfHeight = 0;

      for (const c of candidates) {
        if (x + c.w + margin <= width && y + c.h + margin <= height) {
          chosen = c;
          break;
        }
      }
    }

    if (!chosen) {
      return null;
    }

    placements.push({ id: item.id, x, y, w: chosen.w, h: chosen.h, angle: chosen.angle });
    x += chosen.w + margin;
    shelfHeight = Math.max(shelfHeight, chosen.h);
  }

  const maxX = Math.max(...placements.map((p) => p.x + p.w), 0) + margin;
  const maxY = Math.max(...placements.map((p) => p.y + p.h), 0) + margin;
  return { placements, usedWidth: maxX, usedHeight: maxY };
}

export function computeAutoLayout({ objects, sheetWidth, sheetHeight, margin }) {
  if (!objects.length) {
    return { ok: false, reason: "No hay objetos para acomodar." };
  }

  const sorted = [...objects].sort((a, b) => (b.w * b.h) - (a.w * a.h));
  let low = 0.2;
  let high = 3;
  let best = null;

  for (let i = 0; i < 16; i += 1) {
    const mid = (low + high) / 2;
    const scaled = sorted.map((o) => ({ ...o, w: o.w * mid, h: o.h * mid }));
    const packed = packShelves(scaled, sheetWidth, sheetHeight, margin);

    if (packed) {
      best = { scale: mid, ...packed };
      low = mid;
    } else {
      high = mid;
    }
  }

  if (!best) {
    return { ok: false, reason: "No fue posible acomodar todos los objetos en el pliego." };
  }

  const offsetX = Math.max((sheetWidth - best.usedWidth) / 2, margin);
  const offsetY = Math.max((sheetHeight - best.usedHeight) / 2, margin);

  return {
    ok: true,
    scale: best.scale,
    placements: best.placements.map((p) => ({ ...p, x: p.x + offsetX, y: p.y + offsetY })),
  };
}
