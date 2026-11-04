import { useQuery } from "@tanstack/react-query";
import * as Notifications from "expo-notifications";
import { useEffect } from "react";
import { Platform } from "react-native";

import { allTasksQuery } from "@personal/shared/queries/tasks";
import { timerQuery } from "@personal/shared/queries/timer";
import { useAuthStore } from "@personal/shared/stores/auth";
import { shortTaskTitle } from "@personal/shared/taskTitle";
import { formatClock } from "@personal/shared/timeFormat";

import {
  canNotify,
  END_CHANNEL_ID,
  ONGOING_CHANNEL_ID,
  useNotificationPermissionStore,
  VIBRATION,
} from "./notificationPermission";
import { useTimerNotificationSettingsStore } from "./timerNotificationSettings";

/** One identifier, so a new limit replaces the old notification. */
const NOTIFICATION_ID = "timer-limit";
/** The notification that stays while a timer runs. */
const ONGOING_ID = "timer-ongoing";

// Show the notification even when the app is open; the running timer's
// one only in the list, so it does not pop up over the app.
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const ongoing = notification.request.identifier === ONGOING_ID;
    return {
      shouldShowBanner: !ongoing,
      shouldShowList: true,
      shouldPlaySound: !ongoing,
      shouldSetBadge: false,
    };
  },
});

/**
 * Keeps the phone's notifications in step with the timer's server state:
 * - a limited timer schedules a local notification for the moment it ends,
 *   so it arrives with the app in the background or closed; a new limit
 *   reschedules it;
 * - while a timer runs, a notification that cannot be swiped away shows it
 *   (unless switched off on the Konto screen).
 * A stop, discard or sign-out removes both. A timer stopped elsewhere while
 * the app is closed leaves the running one until the app next fetches the
 * timer. Mounted once in the root layout, next to `TabBarSync`.
 */
export function TimerNotificationSync(): null {
  const signedIn = useAuthStore((state) => state.access !== null);
  const showOngoing = useTimerNotificationSettingsStore(
    (state) => state.showOngoing,
  );
  const { data } = useQuery({ ...timerQuery, enabled: signedIn });
  const entry = signedIn ? (data?.runningEntry ?? null) : null;
  const serverOffset = data?.serverOffset ?? 0;
  const plannedEndMs = entry?.plannedEnd?.getTime() ?? null;
  // The planned end in this device's clock, to the second so a refetch's
  // slightly different offset does not reschedule.
  const fireAt =
    plannedEndMs == null
      ? null
      : Math.round((plannedEndMs - serverOffset) / 1000) * 1000;
  const entryId = entry?.id ?? null;
  const taskId = entry?.taskId ?? null;
  const { data: taskTitle } = useQuery({
    ...allTasksQuery,
    enabled: signedIn && taskId != null,
    select: (tasks) => tasks.find((task) => task.id === taskId)?.title,
  });
  const title = entry?.title || (taskTitle && shortTaskTitle(taskTitle)) || "";
  // Wall-clock times as the timer card shows them.
  const startLabel = entry ? formatClock(entry.start) : null;
  const endLabel = entry?.plannedEnd ? formatClock(entry.plannedEnd) : null;
  // Granting the permission on the Konto screen shows the notification at once.
  const granted = useNotificationPermissionStore((state) => state.granted);
  const ongoing = showOngoing && entryId != null;

  useEffect(() => {
    if (Platform.OS === "web") return;
    let cancelled = false;
    void (async () => {
      await Notifications.cancelScheduledNotificationAsync(NOTIFICATION_ID);
      if (fireAt == null || fireAt <= Date.now() || cancelled) return;
      if (!(await canNotify()) || cancelled) return;
      await Notifications.scheduleNotificationAsync({
        identifier: NOTIFICATION_ID,
        content: {
          title: "Czas minął",
          body: title || "Timer zakończył się.",
          sound: true,
          vibrate: VIBRATION,
          priority: Notifications.AndroidNotificationPriority.MAX,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: fireAt,
          channelId: END_CHANNEL_ID,
        },
      });
    })().catch(() => {
      // Without notifications the timer still stops on the server.
    });
    return () => {
      cancelled = true;
    };
  }, [fireAt, entryId, title, granted]);

  useEffect(() => {
    if (Platform.OS === "web") return;
    let cancelled = false;
    void (async () => {
      if (!ongoing) {
        await Notifications.dismissNotificationAsync(ONGOING_ID);
        return;
      }
      if (!(await canNotify()) || cancelled) return;
      // Posting under the same identifier replaces the shown one in place.
      await Notifications.scheduleNotificationAsync({
        identifier: ONGOING_ID,
        content: {
          title: title || "Timer aktywny",
          body:
            endLabel != null
              ? `Od ${startLabel} · zatrzyma się o ${endLabel}`
              : `Od ${startLabel}`,
          sticky: true,
          autoDismiss: false,
          sound: false,
          priority: Notifications.AndroidNotificationPriority.LOW,
        },
        trigger: { channelId: ONGOING_CHANNEL_ID },
      });
    })().catch(() => {
      // The timer works without its notification.
    });
    return () => {
      cancelled = true;
    };
  }, [ongoing, entryId, title, startLabel, endLabel, granted]);

  return null;
}
