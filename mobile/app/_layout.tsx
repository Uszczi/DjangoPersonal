import "../src/setup";

import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";

import { useAuthStore } from "@personal/shared/stores/auth";

import { common } from "../src/theme";

export default function RootLayout() {
  const [isHydrated, setIsHydrated] = useState(false);
  const isSignedIn = useAuthStore((state) => state.user !== null);

  // The auth store was created before setup pointed it at secure storage,
  // so read the saved session again from there before showing any screen.
  useEffect(() => {
    void Promise.resolve(useAuthStore.persist.rehydrate()).finally(() =>
      setIsHydrated(true),
    );
  }, []);

  if (!isHydrated) {
    return (
      <View style={common.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="auto" />
      <Stack>
        <Stack.Protected guard={isSignedIn}>
          <Stack.Screen name="index" options={{ title: "Projekty" }} />
          <Stack.Screen name="projects/[id]" options={{ title: "Zadania" }} />
          <Stack.Screen name="task" options={{ presentation: "modal", title: "Zadanie" }} />
        </Stack.Protected>
        <Stack.Protected guard={!isSignedIn}>
          <Stack.Screen name="login" options={{ headerShown: false }} />
        </Stack.Protected>
      </Stack>
    </>
  );
}
