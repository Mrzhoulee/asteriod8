import React from "react";
import { View, Text, StyleSheet } from "react-native";

/** High-contrast explicit marker for Apple review visibility */
export function ExplicitBadge() {
  return (
    <View style={styles.wrap} accessibilityLabel="Explicit content">
      <Text style={styles.txt}>E</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginLeft: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: "rgba(0,0,0,0.75)",
    borderWidth: 1,
    borderColor: "#ff453a",
  },
  txt: {
    color: "#ff453a",
    fontSize: 11,
    fontWeight: "800",
  },
});
