/**
 * Example app shell — copy patterns into your Expo / RN project.
 * Install: @react-navigation/native @react-navigation/native-stack react-native-screens react-native-safe-area-context
 */
import React, { useMemo, useState, useCallback } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { TermsGateScreen } from "./src/screens/TermsGateScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";
import { FeedScreen } from "./src/screens/FeedScreen";
import { useTermsGate } from "./src/hooks/useTermsGate";
import { useHideExplicit } from "./src/hooks/useHideExplicit";
import { submitBlock } from "./src/api/client";
import type { SongWithExplicit } from "./src/utils/filterExplicit";

const DEMO_USER_ID = "demo-user-1";
const Stack = createNativeStackNavigator();

function FeedRoute() {
  const { hideExplicit } = useHideExplicit(DEMO_USER_ID);
  const [blocked, setBlocked] = useState<Set<string>>(new Set());

  const songs: SongWithExplicit[] = useMemo(
    () => [
      { id: "1", title: "Clean track", isExplicit: false, uploaderId: "u1" },
      { id: "2", title: "Explicit track", isExplicit: true, uploaderId: "u2" },
    ],
    []
  );

  const onBlockUser = useCallback(async (uploaderId: string) => {
    await submitBlock(DEMO_USER_ID, uploaderId);
    setBlocked((prev) => new Set(prev).add(uploaderId));
  }, []);

  return (
    <FeedScreen
      userId={DEMO_USER_ID}
      songs={songs}
      hideExplicit={hideExplicit}
      blockedUserIds={blocked}
      onBlockUser={onBlockUser}
    />
  );
}

export default function App() {
  const { ready, loading, accepted, agree } = useTermsGate(DEMO_USER_ID);

  if (!ready || loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#ff7f50" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: "#000" },
          headerTintColor: "#fff",
          contentStyle: { backgroundColor: "#000" },
        }}
      >
        {!accepted ? (
          <Stack.Screen name="Terms" options={{ headerShown: false }}>
            {() => (
              <TermsGateScreen
                onAgree={agree}
                termsSummary={`No tolerance for illegal content. You are responsible for your uploads.
Reports are reviewed. See full EULA on our website.`}
              />
            )}
          </Stack.Screen>
        ) : (
          <>
            <Stack.Screen name="Feed" component={FeedRoute} options={{ title: "Discover" }} />
            <Stack.Screen name="Settings" options={{ title: "Settings" }}>
              {() => <SettingsScreen userId={DEMO_USER_ID} />}
            </Stack.Screen>
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: "#000", justifyContent: "center", alignItems: "center" },
});
