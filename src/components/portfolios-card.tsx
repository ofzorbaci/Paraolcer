import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, Field } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import type { Portfolio } from '@/lib/types';
import { addPortfolio, deletePortfolio, renamePortfolio, selectPortfolio, useStore } from '@/state/store';

export const MAIN_PORTFOLIO = 'Ana portföy';
export const NO_PORTFOLIOS: Portfolio[] = [];

/** Premium: separate portfolios (yours, your partner's, your child's). */
export function PortfoliosCard() {
  const portfolios = useStore((s) => s.settings.portfolios) ?? NO_PORTFOLIOS;
  const active = useStore((s) => s.settings.activePortfolio);
  const all = useStore((s) => s.allHoldings);
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<{ id: string; name: string }>();

  const count = (id: string | undefined) => all.filter((h) => h.portfolioId === id).length;

  const remove = (id: string, label: string) =>
    Alert.alert(`“${label}” silinsin mi?`, `İçindeki ${count(id)} varlık da silinir. Bu geri alınamaz.`, [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Sil', style: 'destructive', onPress: () => deletePortfolio(id) },
    ]);

  return (
    <Card>
      <ThemedText style={styles.title}>Portföyler</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Senin, eşinin ya da çocuğunun birikimini ayrı tut. Özet ve grafikler seçili portföyü gösterir; alarm ve hedef
        hepsinin toplamına bakar.
      </ThemedText>
      {[{ id: undefined, name: MAIN_PORTFOLIO }, ...portfolios].map((p) => (
        <View key={p.id ?? 'main'} style={styles.row}>
          <View style={styles.flex}>
            <ThemedText type="smallBold">
              {p.name}
              {p.id === active ? ' · görüntüleniyor' : ''}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {count(p.id)} varlık
            </ThemedText>
          </View>
          {p.id !== active && <Button title="Göster" kind="secondary" compact onPress={() => selectPortfolio(p.id)} />}
          {p.id && <Button title="Ad" kind="secondary" compact onPress={() => setEditing({ id: p.id!, name: p.name })} />}
          {p.id && <Button title="Sil" kind="secondary" compact onPress={() => remove(p.id!, p.name)} />}
        </View>
      ))}
      {editing ? (
        <>
          <Field label="Portföy adı" value={editing.name} onChangeText={(v) => setEditing({ ...editing, name: v })} />
          <Button
            title="Adı kaydet"
            onPress={() => {
              renamePortfolio(editing.id, editing.name);
              setEditing(undefined);
            }}
          />
        </>
      ) : (
        <>
          <Field label="Yeni portföy" placeholder="Örn. Eşimin birikimi" value={name} onChangeText={setName} />
          <Button
            title="Portföy ekle"
            disabled={!name.trim()}
            onPress={() => {
              addPortfolio(name);
              setName('');
            }}
          />
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 19, lineHeight: 26, fontWeight: 700 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  flex: { flex: 1 },
});
