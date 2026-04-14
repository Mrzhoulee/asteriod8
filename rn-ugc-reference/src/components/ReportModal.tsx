import React, { useState, useCallback } from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Alert,
} from "react-native";
import type { ReportContentType, ReportReason } from "../api/client";
import { submitReport } from "../api/client";

const REASONS: { key: ReportReason; label: string }[] = [
  { key: "harassment", label: "Harassment" },
  { key: "hate_speech", label: "Hate speech" },
  { key: "nudity", label: "Nudity" },
  { key: "spam", label: "Spam" },
  { key: "other", label: "Other" },
];

type Props = {
  visible: boolean;
  onClose: () => void;
  userId: string;
  contentId: string;
  contentType: ReportContentType;
};

/**
 * Report flow: visible reasons + optional details — submits to POST /reports.
 */
export function ReportModal({ visible, onClose, userId, contentId, contentType }: Props) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [loading, setLoading] = useState(false);

  const send = useCallback(async () => {
    if (!reason) {
      Alert.alert("Choose a reason", "Select why you are reporting this content.");
      return;
    }
    setLoading(true);
    try {
      await submitReport(userId, { contentId, contentType, reason, details });
      Alert.alert("Report sent", "Thank you. Our team will review this report.");
      onClose();
    } catch {
      Alert.alert("Error", "Could not send report. Check your connection.");
    } finally {
      setLoading(false);
    }
  }, [userId, contentId, contentType, reason, details, onClose]);

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Report content</Text>
          <Text style={styles.sub}>Select the option that best describes the issue.</Text>
          {REASONS.map((r) => (
            <Pressable
              key={r.key}
              style={[styles.reasonRow, reason === r.key && styles.reasonRowActive]}
              onPress={() => setReason(r.key)}
            >
              <Text style={styles.reasonText}>{r.label}</Text>
            </Pressable>
          ))}
          <TextInput
            style={styles.input}
            placeholder="Additional details (optional)"
            placeholderTextColor="#888"
            value={details}
            onChangeText={setDetails}
            multiline
          />
          <View style={styles.actions}>
            <Pressable style={styles.btnGhost} onPress={onClose} disabled={loading}>
              <Text style={styles.btnGhostTxt}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.btnPrimary} onPress={send} disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnPrimaryTxt}>Submit report</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    padding: 20,
  },
  card: {
    backgroundColor: "#1c1c1e",
    borderRadius: 14,
    padding: 18,
  },
  title: { color: "#fff", fontSize: 20, fontWeight: "700", marginBottom: 6 },
  sub: { color: "#aaa", fontSize: 13, marginBottom: 12 },
  reasonRow: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 8,
    backgroundColor: "#2c2c2e",
  },
  reasonRowActive: { borderWidth: 2, borderColor: "#ff7f50" },
  reasonText: { color: "#fff", fontSize: 16 },
  input: {
    minHeight: 72,
    borderRadius: 10,
    backgroundColor: "#2c2c2e",
    color: "#fff",
    padding: 10,
    marginTop: 8,
    marginBottom: 16,
  },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: 12 },
  btnGhost: { paddingVertical: 12, paddingHorizontal: 16 },
  btnGhostTxt: { color: "#ff7f50", fontSize: 16, fontWeight: "600" },
  btnPrimary: {
    backgroundColor: "#ff7f50",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  btnPrimaryTxt: { color: "#111", fontSize: 16, fontWeight: "700" },
});
