import { useEffect, useState } from 'react';
import { CharacterId } from '../types/game';

export const BIMA_REF_IMAGE_PATH =
  '/assets/aistudio/Bima__Pahlawan_Penjelajah_Air_2db9ac7d.png';
export const SINTA_REF_IMAGE_PATH =
  '/assets/aistudio/Penjelajah_Cilik_Pembawa_Air_94ec31d3.png';

const cutoutCache: Partial<Record<CharacterId, string>> = {};
const pendingPromises: Partial<Record<CharacterId, Promise<string>>> = {};

/**
 * Removes the solid white studio background connected to the outer border of the reference
 * 3D character render using an 8-way flood-fill from the image perimeter + soft edge alpha feathering.
 * Because it only flood-fills from the outer border and stops at any shaded contour edge,
 * interior white regions (such as Sinta's white hijab, white jacket stripes, and white shoe soles)
 * remain 100% opaque and intact.
 */
export function loadTransparentCharacterCutout(characterId: CharacterId): Promise<string> {
  const targetId: CharacterId = characterId === 'sinta' ? 'sinta' : 'bima';
  if (cutoutCache[targetId]) {
    return Promise.resolve(cutoutCache[targetId]!);
  }
  if (pendingPromises[targetId]) {
    return pendingPromises[targetId]!;
  }

  const src = targetId === 'sinta' ? SINTA_REF_IMAGE_PATH : BIMA_REF_IMAGE_PATH;

  const promise = new Promise<string>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(src);
          return;
        }

        ctx.drawImage(img, 0, 0, w, h);
        const imageData = ctx.getImageData(0, 0, w, h);
        const data = imageData.data;
        const total = w * h;
        const visited = new Uint8Array(total);
        const isBg = new Uint8Array(total);

        const queue = new Int32Array(total);
        let head = 0;
        let tail = 0;

        // Check if pixel at index i is a near-white studio background pixel
        const canFlood = (idx: number): boolean => {
          const p = idx * 4;
          const r = data[p];
          const g = data[p + 1];
          const b = data[p + 2];
          const cy = Math.floor(idx / w);
          const minC = r < g ? (r < b ? r : b) : g < b ? g : b;
          const maxC = r > g ? (r > b ? r : b) : g > b ? g : b;
          const sat = maxC - minC;
          // At the bottom studio floor (below shoes), remove soft neutral floor shadow too
          if (cy > h * 0.915) {
            return minC >= 185 && sat <= 18;
          }
          return minC >= 244 && sat <= 10;
        };

        const enqueue = (x: number, y: number) => {
          const idx = y * w + x;
          if (visited[idx]) return;
          visited[idx] = 1;
          if (canFlood(idx)) {
            isBg[idx] = 1;
            queue[tail++] = idx;
          }
        };

        // Seed from all 4 outer edges
        for (let x = 0; x < w; x++) {
          enqueue(x, 0);
          enqueue(x, h - 1);
        }
        for (let y = 0; y < h; y++) {
          enqueue(0, y);
          enqueue(w - 1, y);
        }

        // BFS flood-fill from borders inward
        while (head < tail) {
          const curr = queue[head++];
          const cx = curr % w;
          const cy = (curr - cx) / w;

          if (cx > 0) enqueue(cx - 1, cy);
          if (cx < w - 1) enqueue(cx + 1, cy);
          if (cy > 0) enqueue(cx, cy - 1);
          if (cy < h - 1) enqueue(cx, cy + 1);
        }

        // Apply transparency to flooded background pixels and soft anti-aliased edge feathering
        for (let y = 0; y < h; y++) {
          const rowOffset = y * w;
          for (let x = 0; x < w; x++) {
            const idx = rowOffset + x;
            const p = idx * 4;
            if (isBg[idx]) {
              data[p + 3] = 0;
            } else {
              // Check if adjacent to a background pixel for smooth 1px edge anti-aliasing
              const touchesBg =
                (x > 0 && isBg[idx - 1]) ||
                (x < w - 1 && isBg[idx + 1]) ||
                (y > 0 && isBg[idx - w]) ||
                (y < h - 1 && isBg[idx + w]);
              if (touchesBg) {
                const r = data[p];
                const g = data[p + 1];
                const b = data[p + 2];
                const lum = (r + g + b) / 3;
                if (lum > 235) {
                  // Feather bright white halo on outer contour edge
                  data[p + 3] = Math.max(0, Math.min(255, Math.round((252 - lum) * 14)));
                } else {
                  data[p + 3] = 220;
                }
              }
            }
          }
        }

        ctx.putImageData(imageData, 0, 0);
        const dataUrl = canvas.toDataURL('image/png');
        cutoutCache[targetId] = dataUrl;
        resolve(dataUrl);
      } catch {
        resolve(src);
      }
    };
    img.onerror = () => resolve(src);
    img.src = src;
  });

  pendingPromises[targetId] = promise;
  return promise;
}

export function useTransparentCharacterCutout(characterId: CharacterId): string {
  const targetId: CharacterId = characterId === 'sinta' ? 'sinta' : 'bima';
  const [url, setUrl] = useState<string>(
    () =>
      cutoutCache[targetId] ||
      (targetId === 'sinta' ? SINTA_REF_IMAGE_PATH : BIMA_REF_IMAGE_PATH),
  );

  useEffect(() => {
    let active = true;
    loadTransparentCharacterCutout(targetId).then((res) => {
      if (active) setUrl(res);
    });
    return () => {
      active = false;
    };
  }, [targetId]);

  return url;
}
