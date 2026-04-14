import React, { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, Alert } from "react-native";
import { validateText } from "../api/client";

type Props = {
  userId: string;
  /** Persist song with isExplicit + title to your backend (Firestore, etc.) */
  onSubmit: (payload: { title: string; description: string; isExplicit: boolean }) => Promise<void>;
};

/**
 * Upload flow: profanity check on title/description + required explicit self-declaration (Yes/No).
 */
export function UploadSongScreenExample({ userId, onSubmit }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isExplicit, setIsExplicit] = useState<boolean | null>(null);

  const submit = async () => {
    if (isExplicit === null) {
      Alert.alert("Required", "Please answer whether this track contains explicit language.");
      return;
    }
    const tCheck = await validateText(title, "title");
    if (tCheck.blocked) {
      Alert.alert("Not allowed", "This title contains language that cannot be posted.");
      return;
    }
    const dCheck = await validateText(description, "description");
    if (dCheck.blocked) {
      Alert.alert("Not allowed", "This description contains language that cannot be posted.");
      return;
    }
    await onSubmit({ title, description, isExplicit });
    Alert.alert("Uploaded", "Your song is live.");
  };

  void userId;

  return (
    <View style={styles.root}>
      <Text style={styles.h1}>Upload song</Text>
      <Text style={styles.label}>Title</Text>
      <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Title" />
      <Text style={styles.label}>Description</Text>
      <TextInput
        style={[styles.input, { minHeight: 80 }]}
        value={description}
        onChangeText={setDescription}
        multiline
        placeholder="Description"
      />
      <Text style={styles.label}>Does this contain explicit language?</Text>
      <View style={styles.row}>
        <Pressable
          style={[styles.choice, isExplicit === true && styles.choiceOn]}
          onPress={() => setIsExplicit(true)}
        >
          <Text style={styles.choiceTxt}>Yes</Text>
        </Pressable>
        <Pressable
          style={[styles.choice, isExplicit === false && styles.choiceOn]}
          onPress={() => setIsExplicit(false)}
        >
          <Text style={styles.choiceTxt}>No</Text>
        </Pressable>
      </View>
      <Pressable style={styles.btn} onPress={submit}>
        <Text style={styles.btnTxt}>Upload</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 20, backgroundColor: "#000" },
  h1: { color: "#fff", fontSize: 22, fontWeight: "700", marginBottom: 16 },
  label: { color: "#aaa", marginBottom: 6, marginTop: 10 },
  input: {
    backgroundColor: "#1c1c1e",
    color: "#fff",
    borderRadius: 10,
    padding: 12,
  },
  row: { flexDirection: "row", gap: 12, marginVertical: 12 },
  choice: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    backgroundColor: "#2c2c2e",
    alignItems: "center",
  },
  choiceOn: { borderWidth: 2, borderColor: "#ff7f50" },
  choiceTxt: { color: "#fff", fontWeight: "700" },
  btn: {
    marginTop: 24,
    backgroundColor: "#ff7f50",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  btnTxt: { color: "#111", fontWeight: "800", fontSize: 16 },
});
