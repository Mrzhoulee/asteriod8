import React from "react";
import { View, Text, Switch, StyleSheet, ActivityIndicator } from "react-native";
import { useHideExplicit } from "../hooks/useHideExplicit";

type Props = { userId: string };

/**
 * User setting: hide explicit content — default ON (Guideline 1.2 friendly).
 */
export function SettingsScreen({ userId }: Props) {
  const { hideExplicit, setHideExplicit, loading } = useHideExplicit(userId);

  return (
    <View style={styles.root}>
      <Text style={styles.h1}>Content & safety</Text>
      {loading ? (
        <ActivityIndicator color="#ff7f50" />
      ) : (
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Hide explicit content</Text>
              <Text style={styles.sub}>
                When on, songs marked explicit are hidden from your feed and search.
              </Text>
            </View>
            <Switch value={hideExplicit} onValueChange={setHideExplicit} />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 20, backgroundColor: "#000" },
  h1: { color: "#fff", fontSize: 22, fontWeight: "700", marginBottom: 20 },
  card: {
    backgroundColor: "#1c1c1e",
    borderRadius: 12,
    padding: 16,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  title: { color: "#fff", fontSize: 17, fontWeight: "600" },
  sub: { color: "#888", fontSize: 13, marginTop: 4 },
});
