import "../src/setup";

import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";

import { useAuthStore } from "@personal/shared/stores/auth";

import { queryClient } from "../src/queryClient";
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
    <QueryClientProvider client={queryClient}>
      <StatusBar style="auto" />
      <Stack>
        <Stack.Protected guard={isSignedIn}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="projects/[id]" options={{ title: "Zadania" }} />
          <Stack.Screen
            name="task"
            options={{ presentation: "modal", title: "Zadanie" }}
          />
          <Stack.Screen name="counters/[id]" options={{ title: "Licznik" }} />
          <Stack.Screen
            name="counter"
            options={{ presentation: "modal", title: "Licznik" }}
          />
          <Stack.Screen
            name="counter-entry"
            options={{ presentation: "modal", title: "Wpis" }}
          />
          <Stack.Screen
            name="project"
            options={{ presentation: "modal", title: "Projekt" }}
          />
          <Stack.Screen
            name="time-entry"
            options={{ presentation: "modal", title: "Wpis czasu" }}
          />
          <Stack.Screen
            name="wallet"
            options={{ presentation: "modal", title: "Portfel" }}
          />
          <Stack.Screen
            name="transaction"
            options={{ presentation: "modal", title: "Transakcja" }}
          />
          <Stack.Screen name="categories" options={{ title: "Kategorie" }} />
          <Stack.Screen
            name="category"
            options={{ presentation: "modal", title: "Kategoria" }}
          />
        </Stack.Protected>
        <Stack.Protected guard={!isSignedIn}>
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="register" options={{ headerShown: false }} />
        </Stack.Protected>
      </Stack>
    </QueryClientProvider>
  );
}
