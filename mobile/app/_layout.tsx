import "@/setup";
import "../global.css";

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

import { useCounterViewStore } from "@personal/shared/stores/counterView";
import { queryClient } from "@/queryClient";
import { TabBarSync } from "@/features/tabs/TabBarSync";
import { useTabBarStore } from "@/features/tabs/tabBar";
import { useTaskListSettingsStore } from "@/features/tasks/taskListSettings";
import { useTaskProjectStore } from "@/features/tasks/taskProject";
import {
  AccountThemeSync,
  useNativeColorScheme,
  useTheme,
  useUniwindTheme,
} from "@/theme";
import { common } from "@/ui/classes";
import { StackHeader } from "@/ui/NavigationHeader";

const modalScreens = [
  ["project", "Projekt"],
  ["task", "Zadanie"],
  ["time-entry", "Wpis czasu"],
  ["wallet", "Portfel"],
  ["transaction", "Transakcja"],
  ["category", "Kategoria"],
  ["counter", "Licznik"],
  ["counter-entry", "Wpis"],
  ["bibliography-item", "Pozycja"],
  ["attempt", "Podejście"],
  ["attempt-progress", "Postęp"],
] as const;

export default function RootLayout() {
  const { stackOptions } = useTheme();
  const [isHydrated, setIsHydrated] = useState(false);
  const isSignedIn = useAuthStore((state) => state.user !== null);
  useNativeColorScheme();
  useUniwindTheme();

  useEffect(() => {
    void Promise.allSettled([
      useAuthStore.persist.rehydrate(),
      useThemeStore.persist.rehydrate(),
      useCounterViewStore.persist.rehydrate(),
      useNewTaskStatusStore.persist.rehydrate(),
      useBibliographyViewStore.persist.rehydrate(),
      useTabBarStore.persist.rehydrate(),
      useTaskProjectStore.persist.rehydrate(),
      useTaskListSettingsStore.persist.rehydrate(),
    ]).finally(() => setIsHydrated(true));
  }, []);

  if (!isHydrated) {
    return (
      <View className={common.center}>
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
        <TabBarSync />
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            ...stackOptions,
            header: (props) => <StackHeader {...props} />,
          }}
        >
          <Stack.Protected guard={isSignedIn}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="projects/[id]" options={{ title: "Zadania" }} />
            <Stack.Screen name="counters/[id]" options={{ title: "Licznik" }} />
            <Stack.Screen
              name="bibliography/[id]"
              options={{ title: "Pozycja" }}
            />
            <Stack.Screen name="categories" options={{ title: "Kategorie" }} />
            {modalScreens.map(([name, title]) => (
              <Stack.Screen
                key={name}
                name={`(modals)/${name}`}
                options={{ presentation: "modal", title }}
              />
            ))}
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
