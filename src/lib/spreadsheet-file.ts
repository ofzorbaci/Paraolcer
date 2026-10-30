import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Saves the workbook to a temporary file and opens the share sheet (Files, Drive, mail…). */
export async function shareWorkbook(bytes: Uint8Array, filename: string): Promise<void> {
  const f = new File(Paths.cache, filename);
  f.create({ overwrite: true });
  await f.write(bytes);
  await Sharing.shareAsync(f.uri, { mimeType: XLSX_MIME, UTI: 'org.openxmlformats.spreadsheetml.sheet', dialogTitle: filename });
}

/** Lets the user pick an Excel or CSV file; CSV comes back as text, Excel as bytes. */
export async function pickSpreadsheet(): Promise<{ name: string; data: Uint8Array | string } | undefined> {
  const r = await DocumentPicker.getDocumentAsync({
    type: [XLSX_MIME, 'application/vnd.ms-excel', 'text/csv', 'text/comma-separated-values', 'text/plain', '*/*'],
    copyToCacheDirectory: true,
  });
  if (r.canceled) return undefined;
  const asset = r.assets[0];
  const f = new File(asset.uri);
  const isText = /\.(csv|txt)$/i.test(asset.name) || asset.mimeType?.startsWith('text/');
  return { name: asset.name, data: isText ? await f.text() : await f.bytes() };
}
