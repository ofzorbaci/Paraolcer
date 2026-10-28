import { useState } from 'react';

import { Field } from '@/components/ui';
import { formatDate, parseDate } from '@/lib/format';

type Props = { label: string; value: string | undefined; onChange: (iso: string) => void; max: string };

/** The web build has no native picker, so dates are typed as GG.AA.YYYY. */
export function DateField({ label, value, onChange, max }: Props) {
  const [text, setText] = useState(value ? formatDate(value) : '');
  const parsed = parseDate(text, max);
  return (
    <Field
      label={label}
      placeholder="GG.AA.YYYY"
      value={text}
      onChangeText={(t) => {
        setText(t);
        const iso = parseDate(t, max);
        if (iso) onChange(iso);
      }}
      error={text.length >= 8 && !parsed ? '2005 ile bugün arasında geçerli bir tarih gir' : undefined}
    />
  );
}
