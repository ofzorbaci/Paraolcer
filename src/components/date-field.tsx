import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatLongDate, toISODate } from '@/lib/format';

type Props = { label: string; value: string | undefined; onChange: (iso: string) => void; max: string };

const MIN = new Date(2005, 0, 1);

function toDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Native date picker: compact on iOS, dialog on Android. Values are 'YYYY-MM-DD'. */
export function DateField({ label, value, onChange, max }: Props) {
  const theme = useTheme();
  const current = toDate(value ?? max);

  return (
    <View style={styles.field}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      {Platform.OS === 'ios' ? (
        <View style={[styles.box, styles.iosBox, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}>
          <DateTimePicker
            value={current}
            mode="date"
            display="compact"
            locale="tr-TR"
            minimumDate={MIN}
            maximumDate={toDate(max)}
            onValueChange={(_, d) => onChange(toISODate(d))}
          />
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            DateTimePickerAndroid.open({
              value: current,
              mode: 'date',
              minimumDate: MIN,
              maximumDate: toDate(max),
              onValueChange: (_, d) => onChange(toISODate(d)),
            })
          }
          style={[styles.box, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}>
          <ThemedText style={styles.text} themeColor={value ? 'text' : 'textSecondary'}>
            {value ? formatLongDate(value) : 'Tarih seç'}
          </ThemedText>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  box: { borderWidth: 1, borderRadius: Radius.inner, paddingHorizontal: Spacing.three, paddingVertical: 14 },
  iosBox: { paddingVertical: 8, alignItems: 'flex-start' },
  text: { fontSize: 17 },
});
