import * as DocumentPicker from 'expo-document-picker';

export async function shareWorkbook(bytes: Uint8Array, filename: string): Promise<void> {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function pickSpreadsheet(): Promise<{ name: string; data: Uint8Array | string } | undefined> {
  const r = await DocumentPicker.getDocumentAsync({ type: ['.xlsx', '.xls', '.csv', 'text/csv'] });
  if (r.canceled) return undefined;
  const asset = r.assets[0];
  const res = await fetch(asset.uri);
  const isText = /\.(csv|txt)$/i.test(asset.name);
  return { name: asset.name, data: isText ? await res.text() : new Uint8Array(await res.arrayBuffer()) };
}
