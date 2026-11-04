import { describe, expect, it } from 'vitest';

import { parseStatementLines } from '../budget/statement';
import { pdfLines } from '../budget/statement-pdf';

/** A one-page PDF with each cell as its own text object, the way bank PDFs are laid out. */
function statementPdf(rows: string[][]): Uint8Array {
  const xs = [40, 120, 380, 470];
  let content = 'BT /F1 10 Tf\n';
  rows.forEach((r, i) => r.forEach((cell, j) => (content += `1 0 0 1 ${xs[j]} ${760 - i * 18} Tm (${cell}) Tj\n`)));
  content += 'ET\n';
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${content.length} >>\nstream\n${content}endstream`,
  ];
  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(pdf);
}

describe('PDF statement import', () => {
  it('reads lines by position and turns them into transactions', async () => {
    const bytes = statementPdf([
      ['Tarih', 'Aciklama', 'Tutar', 'Bakiye'],
      ['03.10.2026', 'MIGROS KADIKOY', '-1.234,56', '50.765,44'],
      ['05.10.2026', 'KIRA EKIM', '-20.000,00', '30.765,44'],
      ['06.10.2026', 'NETFLIX.COM', '-229,99', '30.535,45'],
    ]);
    const lines = await pdfLines(bytes);
    expect(lines[1]).toBe('03.10.2026 MIGROS KADIKOY -1.234,56 50.765,44');
    const rows = parseStatementLines(lines, []);
    expect(rows.map((r) => [r.date, r.amount, r.categoryId])).toEqual([
      ['2026-10-03', -1234.56, 'market'],
      ['2026-10-05', -20000, 'rent'],
      ['2026-10-06', -229.99, 'subscriptions'],
    ]);
  });
});
