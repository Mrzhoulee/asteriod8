import React, { useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, Switch } from "react-native";

type Props = {
  onAgree: () => void;
  /** Plain-language summary — replace with your full EULA / link to WebView */
  termsSummary: string;
};

/**
 * EULA gate: checkbox + Agree — call `onAgree` which should persist via API + navigate.
 */
export function TermsGateScreen({ onAgree, termsSummary }: Props) {
  const [checked, setChecked] = useState(false);

  return (
    <View style={styles.root}>
      <Text style={styles.h1}>Terms of Use</Text>
      <Text style={styles.p}>
        This app includes user-generated music and text. You must accept the Terms of Use before
        accessing any content.
      </Text>
      <ScrollView style={styles.scroll}>
        <Text style={styles.termsBody}>{termsSummary}</Text>
      </ScrollView>
      <View style={styles.row}>
        <Switch value={checked} onValueChange={setChecked} />
        <Text style={styles.label}>I have read and agree to the Terms of Use</Text>
      </View>
      <Pressable
        style={[styles.agree, !checked && styles.agreeDisabled]}
        onPress={() => checked && onAgree()}
        disabled={!checked}
      >
        <Text style={styles.agreeTxt}>Agree and continue</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 20, paddingTop: 56, backgroundColor: "#000" },
  h1: { color: "#fff", fontSize: 26, fontWeight: "800", marginBottom: 12 },
  p: { color: "#ccc", fontSize: 14, lineHeight: 20, marginBottom: 12 },
  scroll: { flex: 1, marginVertical: 12 },
  termsBody: { color: "#aaa", fontSize: 13, lineHeight: 20 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 },
  label: { flex: 1, color: "#fff", fontSize: 15 },
  agree: {
    backgroundColor: "#ff7f50",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  agreeDisabled: { opacity: 0.45 },
  agreeTxt: { color: "#111", fontSize: 17, fontWeight: "800" },
});
