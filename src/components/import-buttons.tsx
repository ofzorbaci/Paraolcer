import { router } from 'expo-router';

import { Button } from '@/components/ui';
import { templateWorkbook } from '@/lib/spreadsheet';
import { shareWorkbook } from '@/lib/spreadsheet-file';

/** "Download the template, fill it in, upload it": both steps together wherever import is offered. */
export function ImportButtons() {
  return (
    <>
      <Button
        title="Örnek Excel şablonunu indir"
        kind="secondary"
        onPress={() => void shareWorkbook(templateWorkbook(), 'paraolcer-sablon.xlsx')}
      />
      <Button title="Excel / CSV’den yükle" kind="secondary" onPress={() => router.push('/import')} />
    </>
  );
}
