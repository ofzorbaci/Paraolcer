// PDF statements, read on the phone: the text is regrouped into lines by its position on the page,
// so it works whether or not the bank's PDF marks line ends.

type TextItem = { str: string; transform: number[] };

/**
 * pdf.js uses two newer built-ins the phone's JavaScript engine may lack; plain stand-ins are
 * enough for reading text, and they are installed only when missing.
 */
function polyfill() {
  const P = Promise as unknown as { withResolvers?: () => unknown };
  if (!P.withResolvers) {
    P.withResolvers = () => {
      let resolve!: (v: unknown) => void;
      let reject!: (e: unknown) => void;
      const promise = new Promise((res, rej) => {
        resolve = res;
        reject = rej;
      });
      return { promise, resolve, reject };
    };
  }
  const g = globalThis as unknown as { structuredClone?: (v: unknown) => unknown };
  if (!g.structuredClone) {
    const clone = (v: unknown): unknown => {
      if (v === null || typeof v !== 'object') return v;
      if (ArrayBuffer.isView(v)) return (v as Uint8Array).slice();
      if (v instanceof ArrayBuffer) return v.slice(0);
      if (v instanceof Map) return new Map([...v].map(([k, x]) => [k, clone(x)]));
      if (Array.isArray(v)) return v.map(clone);
      return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, clone(x)]));
    };
    g.structuredClone = clone;
  }
}

/** Every text line of the PDF, top to bottom, page by page. */
export async function pdfLines(bytes: Uint8Array): Promise<string[]> {
  polyfill();
  const { getDocumentProxy } = await import('unpdf');
  const pdf = await getDocumentProxy(bytes);
  const lines: string[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const { items } = await page.getTextContent();
    const rows = new Map<number, { x: number; s: string }[]>();
    for (const it of items as TextItem[]) {
      if (!it.str?.trim()) continue;
      // Items within 3 points of each other vertically belong to the same line.
      const y = Math.round(it.transform[5] / 3) * 3;
      rows.set(y, [...(rows.get(y) ?? []), { x: it.transform[4], s: it.str }]);
    }
    [...rows]
      .sort(([a], [b]) => b - a)
      .forEach(([, cells]) => lines.push(cells.sort((a, b) => a.x - b.x).map((c) => c.s.trim()).join(' ')));
  }
  return lines;
}
