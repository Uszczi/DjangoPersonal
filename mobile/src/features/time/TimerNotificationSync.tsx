import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Notifications from "expo-notifications";
import { useEffect } from "react";
import { Platform } from "react-native";

import { allTasksQuery } from "@personal/shared/queries/tasks";
import { timerQuery } from "@personal/shared/queries/timer";
import { useAuthStore } from "@personal/shared/stores/auth";

/** One identifier, so a new limit replaces the old notification. */
const NOTIFICATION_ID = "timer-limit";
const CHANNEL_ID = "timer";

// Show the notification even when the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** Asks once; Android 13+ needs the channel before it shows the prompt. */
async function canNotify(): Promise<boolean> {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: "Timer",
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

/**
 * Schedules a local notification for the moment a limited timer ends, so it
 * arrives with the app in the background or closed. Follows the timer's
 * server state: a new limit reschedules it, a stop, discard or sign-out
 * cancels it. Mounted once in the root layout, next to `TabBarSync`.
 */
export function TimerNotificationSync(): null {
  const queryClient = useQueryClient();
  const signedIn = useAuthStore((state) => state.access !== null);
  const { data } = useQuery({ ...timerQuery, enabled: signedIn });
  const entry = signedIn ? (data?.runningEntry ?? null) : null;
  const plannedEndMs = entry?.plannedEnd?.getTime() ?? null;
  // The planned end in this device's clock, to the second so a refetch's
  // slightly different offset does not reschedule.
  const fireAt =
    plannedEndMs == null
      ? null
      : Math.round((plannedEndMs - (data?.serverOffset ?? 0)) / 1000) * 1000;
  const entryId = entry?.id ?? null;
  const entryTitle = entry?.title ?? "";
  const taskId = entry?.taskId ?? null;

  useEffect(() => {
    if (Platform.OS === "web") return;
    let cancelled = false;
    void (async () => {
      await Notifications.cancelScheduledNotificationAsync(NOTIFICATION_ID);
      if (fireAt == null || fireAt <= Date.now() || cancelled) return;
      if (!(await canNotify()) || cancelled) return;
      const taskTitle =
        taskId == null
          ? undefined
          : queryClient
              .getQueryData(allTasksQuery.queryKey)
              ?.find((task) => task.id === taskId)?.title;
      await Notifications.scheduleNotificationAsync({
        identifier: NOTIFICATION_ID,
        content: {
          title: "Czas minął",
          body: entryTitle || taskTitle || "Timer zakończył się.",
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: fireAt,
          channelId: CHANNEL_ID,
        },
      });
    })().catch(() => {
      // Without notifications the timer still stops on the server.
    });
    return () => {
      cancelled = true;
    };
  }, [fireAt, entryId, entryTitle, taskId, queryClient]);

  return null;
}
