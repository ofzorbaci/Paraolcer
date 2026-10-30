import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Radius } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatLongDate, toISODate } from '@/lib/format';

type Props = { label: string; value: string | undefined; onChange: (iso: string) => void; max: string };

const MIN = new Date(2005, 0, 1);

function toDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * A field that opens a calendar. Tapping a day picks it and closes the calendar at once (iOS
 * sheet, Android dialog); changing only the month or year keeps it open. Values are 'YYYY-MM-DD'.
 */
export function DateField({ label, value, onChange, max }: Props) {
  const theme = useTheme();
  const current = toDate(value ?? max);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(current);

  const show = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: current,
        mode: 'date',
        minimumDate: MIN,
        maximumDate: toDate(max),
        onValueChange: (_, d) => onChange(toISODate(d)),
      });
      return;
    }
    setDraft(current);
    setOpen(true);
  };

  const pick = (d: Date) => {
    // A different day is a choice; a month/year change is still browsing.
    const chosen = d.getDate() !== draft.getDate();
    setDraft(d);
    if (chosen) {
      onChange(toISODate(d));
      setOpen(false);
    }
  };

  const done = () => {
    onChange(toISODate(draft));
    setOpen(false);
  };

  return (
    <View style={styles.field}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={show}
        style={[styles.box, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}>
        <ThemedText style={styles.text} themeColor={value ? 'text' : 'textSecondary'}>
          {value ? formatLongDate(value) : 'Tarih seç'}
        </ThemedText>
      </Pressable>

      {Platform.OS === 'ios' && (
        <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
            <Pressable style={[styles.sheet, { backgroundColor: theme.backgroundElement }]} onPress={() => {}}>
              <ThemedText type="smallBold">{label}</ThemedText>
              <DateTimePicker
                value={draft}
                mode="date"
                display="inline"
                locale="tr-TR"
                minimumDate={MIN}
                maximumDate={toDate(max)}
                accentColor={theme.accent}
                onValueChange={(_, d) => pick(d)}
              />
              <Button title="Tamam" onPress={done} />
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  box: { borderWidth: 1, borderRadius: Radius.inner, paddingHorizontal: Spacing.three, paddingVertical: 14 },
  text: { fontSize: 17 },
  backdrop: { flex: 1, backgroundColor: 'rgba(10,16,28,0.45)', justifyContent: 'center', padding: Spacing.three },
  sheet: { borderRadius: 20, padding: Spacing.three, gap: Spacing.two },
});
