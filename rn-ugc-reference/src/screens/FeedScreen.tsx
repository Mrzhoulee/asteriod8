import React, { useMemo, useState } from "react";
import { View, Text, FlatList, Pressable, StyleSheet } from "react-native";
import type { SongWithExplicit } from "../utils/filterExplicit";
import { filterFeedSongs } from "../utils/filterExplicit";
import { ExplicitBadge } from "../components/ExplicitBadge";
import { ReportModal } from "../components/ReportModal";

type Props = {
  userId: string;
  songs: SongWithExplicit[];
  hideExplicit: boolean;
  blockedUserIds: Set<string>;
  onBlockUser?: (uploaderId: string) => void;
};

/**
 * Feed with visible **Report** actions, explicit badge, and client-side filtering.
 */
export function FeedScreen({ userId, songs, hideExplicit, blockedUserIds, onBlockUser }: Props) {
  const [reportSong, setReportSong] = useState<SongWithExplicit | null>(null);

  const data = useMemo(
    () => filterFeedSongs(songs, { hideExplicit, blockedUserIds }),
    [songs, hideExplicit, blockedUserIds]
  );

  return (
    <View style={styles.root}>
      <Text style={styles.h1}>Discover</Text>
      <FlatList
        data={data}
        keyExtractor={(s) => s.id}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text style={styles.title}>{item.title}</Text>
                {item.isExplicit ? <ExplicitBadge /> : null}
              </View>
              {item.uploaderId ? (
                <Text style={styles.meta}>User: {item.uploaderId}</Text>
              ) : null}
            </View>
            <Pressable
              style={styles.reportBtn}
              onPress={() => setReportSong(item)}
              accessibilityRole="button"
            >
              <Text style={styles.reportTxt}>Report</Text>
            </Pressable>
            {item.uploaderId && onBlockUser ? (
              <Pressable style={styles.blockBtn} onPress={() => onBlockUser(item.uploaderId!)}>
                <Text style={styles.blockTxt}>Block</Text>
              </Pressable>
            ) : null}
          </View>
        )}
      />
      <ReportModal
        visible={!!reportSong}
        onClose={() => setReportSong(null)}
        userId={userId}
        contentId={reportSong?.id || ""}
        contentType="song"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000", paddingTop: 48 },
  h1: { color: "#fff", fontSize: 22, fontWeight: "700", paddingHorizontal: 16, marginBottom: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "#333",
  },
  title: { color: "#fff", fontSize: 16, fontWeight: "600" },
  meta: { color: "#888", fontSize: 12, marginTop: 4 },
  reportBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "rgba(255,127,80,0.2)",
    borderWidth: 1,
    borderColor: "#ff7f50",
  },
  reportTxt: { color: "#ff7f50", fontWeight: "700", fontSize: 14 },
  blockBtn: {
    marginLeft: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#2c2c2e",
  },
  blockTxt: { color: "#fff", fontWeight: "600", fontSize: 14 },
});
