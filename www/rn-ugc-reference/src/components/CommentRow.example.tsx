import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { ReportModal } from "./ReportModal";

type Props = {
  userId: string;
  commentId: string;
  authorLabel: string;
  body: string;
};

/** Comments: visible Report control for Guideline 1.2 */
export function CommentRowExample({ userId, commentId, authorLabel, body }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.author}>{authorLabel}</Text>
        <Text style={styles.body}>{body}</Text>
      </View>
      <Pressable style={styles.reportBtn} onPress={() => setOpen(true)}>
        <Text style={styles.reportTxt}>Report</Text>
      </Pressable>
      <ReportModal
        visible={open}
        onClose={() => setOpen(false)}
        userId={userId}
        contentId={commentId}
        contentType="comment"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    padding: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "#333",
  },
  author: { color: "#ff7f50", fontWeight: "600", marginBottom: 4 },
  body: { color: "#eee" },
  reportBtn: {
    alignSelf: "flex-start",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ff7f50",
  },
  reportTxt: { color: "#ff7f50", fontWeight: "700", fontSize: 13 },
});
