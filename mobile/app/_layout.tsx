import "../src/setup";

import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";

import { useAuthStore } from "@personal/shared/stores/auth";
import { useNewTaskStatusStore } from "@personal/shared/stores/newTaskStatus";
import { useThemeStore } from "@personal/shared/stores/theme";

import { useCounterViewStore } from "../src/counterView";
import { queryClient } from "../src/queryClient";
import { useTabBarStore } from "../src/tabBar";
import { useNativeColorScheme, useTheme } from "../src/theme";

export default function RootLayout() {
  const { common, headerOptions } = useTheme();
  const [isHydrated, setIsHydrated] = useState(false);
  const isSignedIn = useAuthStore((state) => state.user !== null);
  useNativeColorScheme();

  // The persisted stores were created before setup pointed them at secure
  // storage, so read the saved session and the theme, view, status and tab
  // bar choices again from there before showing any screen.
  useEffect(() => {
    void Promise.allSettled([
      useAuthStore.persist.rehydrate(),
      useThemeStore.persist.rehydrate(),
      useCounterViewStore.persist.rehydrate(),
      useNewTaskStatusStore.persist.rehydrate(),
      useTabBarStore.persist.rehydrate(),
    ]).finally(() => setIsHydrated(true));
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
      <StatusBar style="light" />
      <Stack screenOptions={headerOptions}>
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
          <Stack.Screen
            name="bibliography/[id]"
            options={{ title: "Pozycja" }}
          />
          <Stack.Screen
            name="bibliography-item"
            options={{ presentation: "modal", title: "Pozycja" }}
          />
          <Stack.Screen
            name="attempt"
            options={{ presentation: "modal", title: "Podejście" }}
          />
          <Stack.Screen
            name="attempt-progress"
            options={{ presentation: "modal", title: "Postęp" }}
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
