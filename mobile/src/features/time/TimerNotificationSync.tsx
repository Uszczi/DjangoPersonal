import { useQuery } from "@tanstack/react-query";
import * as Notifications from "expo-notifications";
import { useEffect } from "react";
import { Platform } from "react-native";

import { allTasksQuery } from "@personal/shared/queries/tasks";
import { timerQuery } from "@personal/shared/queries/timer";
import { useAuthStore } from "@personal/shared/stores/auth";
import { shortTaskTitle } from "@personal/shared/taskTitle";
import { formatClock } from "@personal/shared/timeFormat";

import { useTimerNotificationSettingsStore } from "./timerNotificationSettings";

/** One identifier, so a new limit replaces the old notification. */
const NOTIFICATION_ID = "timer-limit";
/** The notification that stays while a timer runs. */
const ONGOING_ID = "timer-ongoing";
/**
 * Android fixes a channel's sound and vibration when it is created, so a
 * change to them needs a new id; the old ones are deleted.
 */
const CHANNEL_ID = "timer-end";
const OLD_CHANNEL_IDS = ["timer", "timer-alarm"];
/** A quiet channel: the running timer sits in the shade, no sound or banner. */
const ONGOING_CHANNEL_ID = "timer-running";
const VIBRATION = [0, 500, 250, 500, 250, 500];

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

/** Asks once; Android 13+ needs the channel before it shows the prompt. */
async function canNotify(): Promise<boolean> {
  if (Platform.OS === "android") {
    await Promise.all(
      OLD_CHANNEL_IDS.map((id) =>
        Notifications.deleteNotificationChannelAsync(id),
      ),
    );
    // The notification stream follows the ringer: sound normally, only the
    // vibration in vibrate mode.
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: "Koniec timera",
      importance: Notifications.AndroidImportance.MAX,
      enableVibrate: true,
      vibrationPattern: VIBRATION,
    });
    await Notifications.setNotificationChannelAsync(ONGOING_CHANNEL_ID, {
      name: "Aktywny timer",
      importance: Notifications.AndroidImportance.LOW,
      sound: null,
      enableVibrate: false,
      showBadge: false,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

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
          channelId: CHANNEL_ID,
        },
      });
    })().catch(() => {
      // Without notifications the timer still stops on the server.
    });
    return () => {
      cancelled = true;
    };
  }, [fireAt, entryId, title]);

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
  }, [ongoing, entryId, title, startLabel, endLabel]);

  return null;
}
