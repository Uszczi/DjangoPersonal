import "../src/setup";

import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { persistOptions } from "@personal/shared/queries/persist";
import { useAuthStore } from "@personal/shared/stores/auth";
import { useBibliographyViewStore } from "@personal/shared/stores/bibliographyView";
import { useNewTaskStatusStore } from "@personal/shared/stores/newTaskStatus";
import { useThemeStore } from "@personal/shared/stores/theme";

import { useCounterViewStore } from "../src/counterView";
import { queryClient } from "../src/queryClient";
import { useTabBarStore } from "../src/tabBar";
import { useTaskProjectStore } from "../src/taskProject";
import { AccountThemeSync, useNativeColorScheme, useTheme } from "../src/theme";

export default function RootLayout() {
  const { common, headerOptions } = useTheme();
  const [isHydrated, setIsHydrated] = useState(false);
  const isSignedIn = useAuthStore((state) => state.user !== null);
  useNativeColorScheme();

  // The persisted stores were created before setup pointed them at secure
  // storage, so read the saved session and the theme, view, status, tab
  // bar and Zadania project choices again from there before showing any
  // screen.
  useEffect(() => {
    void Promise.allSettled([
      useAuthStore.persist.rehydrate(),
      useThemeStore.persist.rehydrate(),
      useCounterViewStore.persist.rehydrate(),
      useNewTaskStatusStore.persist.rehydrate(),
      useBibliographyViewStore.persist.rehydrate(),
      useTabBarStore.persist.rehydrate(),
      useTaskProjectStore.persist.rehydrate(),
    ]).finally(() => setIsHydrated(true));
  }, []);

  if (!isHydrated) {
    return (
      <View style={common.center}>
        <ActivityIndicator />
      </View>
    );
  }

  // The gesture root lets the Project screen drag Tasks to reorder them.
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={persistOptions}
      >
        <AccountThemeSync />
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
      </PersistQueryClientProvider>
    </GestureHandlerRootView>
  );
}
