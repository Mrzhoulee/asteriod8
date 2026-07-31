import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet, Alert } from "react-native";
import { ReportModal } from "../components/ReportModal";
import { submitBlock } from "../api/client";

type Props = {
  viewerId: string;
  profileUserId: string;
  displayName: string;
  /** After block: parent should remove from feed / pop stack */
  onBlocked?: () => void;
};

/**
 * Profile: **Report** + **Block user** — buttons visible for Apple review.
 */
export function ProfileScreenExample({ viewerId, profileUserId, displayName, onBlocked }: Props) {
  const [reportOpen, setReportOpen] = useState(false);

  const block = async () => {
    Alert.alert("Block this user?", "Their content will disappear from your feed.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Block",
        style: "destructive",
        onPress: async () => {
          await submitBlock(viewerId, profileUserId);
          onBlocked?.();
        },
      },
    ]);
  };

  return (
    <View style={styles.root}>
      <Text style={styles.name}>{displayName}</Text>
      <View style={styles.actions}>
        <Pressable style={styles.report} onPress={() => setReportOpen(true)}>
          <Text style={styles.reportTxt}>Report profile</Text>
        </Pressable>
        <Pressable style={styles.block} onPress={block}>
          <Text style={styles.blockTxt}>Block user</Text>
        </Pressable>
      </View>
      <ReportModal
        visible={reportOpen}
        onClose={() => setReportOpen(false)}
        userId={viewerId}
        contentId={profileUserId}
        contentType="profile"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 20, backgroundColor: "#000" },
  name: { color: "#fff", fontSize: 24, fontWeight: "800", marginBottom: 20 },
  actions: { gap: 12 },
  report: {
    padding: 14,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#ff7f50",
    alignItems: "center",
  },
  reportTxt: { color: "#ff7f50", fontWeight: "800", fontSize: 16 },
  block: {
    padding: 14,
    borderRadius: 10,
    backgroundColor: "#2c2c2e",
    alignItems: "center",
  },
  blockTxt: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
