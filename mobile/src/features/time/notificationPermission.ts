import * as Notifications from "expo-notifications";
import { useEffect } from "react";
import { AppState, Linking, Platform } from "react-native";
import { create } from "zustand";

/**
 * Android fixes a channel's sound and vibration when it is created, so a
 * change to them needs a new id; the old ones are deleted.
 */
export const END_CHANNEL_ID = "timer-end";
const OLD_CHANNEL_IDS = ["timer", "timer-alarm"];
/** A quiet channel: the running timer sits in the shade, no sound or banner. */
export const ONGOING_CHANNEL_ID = "timer-running";
export const VIBRATION = [0, 500, 250, 500, 250, 500];

/**
 * Android 13+ shows the permission prompt only once a channel exists. Each
 * step may fail on its own (Expo Go's channel manager rejects every call), and
 * none of them may stop the permission check that follows.
 */
async function ensureChannels() {
  if (Platform.OS !== "android") return;
  const ignore = () => {};
  await Promise.all(
    OLD_CHANNEL_IDS.map((id) =>
      Notifications.deleteNotificationChannelAsync(id).catch(ignore),
    ),
  );
  // The notification stream follows the ringer: sound normally, only the
  // vibration in vibrate mode.
  await Notifications.setNotificationChannelAsync(END_CHANNEL_ID, {
    name: "Koniec timera",
    importance: Notifications.AndroidImportance.MAX,
    enableVibrate: true,
    vibrationPattern: VIBRATION,
  }).catch(ignore);
  await Notifications.setNotificationChannelAsync(ONGOING_CHANNEL_ID, {
    name: "Aktywny timer",
    importance: Notifications.AndroidImportance.LOW,
    sound: null,
    enableVibrate: false,
    showBadge: false,
  }).catch(ignore);
}

type PermissionState = {
  /** `null` until the first check. */
  granted: boolean | null;
  /** Whether the system will still show its prompt. */
  canAskAgain: boolean;
  refresh: () => Promise<boolean>;
  /** The system prompt, or the app's settings once Android stops asking. */
  request: () => Promise<boolean>;
};

/**
 * Whether this device lets the app notify, shared by the timer's
 * notifications and the Konto screen, which offers to grant it.
 */
export const useNotificationPermissionStore = create<PermissionState>()(
  (set, get) => ({
    granted: null,
    canAskAgain: true,
    refresh: async () => {
      if (Platform.OS === "web") return false;
      await ensureChannels();
      const { granted, canAskAgain } =
        await Notifications.getPermissionsAsync();
      set({ granted, canAskAgain });
      return granted;
    },
    request: async () => {
      if (Platform.OS === "web") return false;
      if ((await get().refresh()) === true) return true;
      if (!get().canAskAgain) {
        // Returning from the settings refreshes the state (`useNotificationPermission`).
        await Linking.openSettings();
        return false;
      }
      const { granted, canAskAgain } =
        await Notifications.requestPermissionsAsync();
      set({ granted, canAskAgain });
      return granted;
    },
  }),
);

/**
 * Asks once when the permission was never decided; true when the app may
 * notify. Never opens the settings by itself.
 */
export async function canNotify(): Promise<boolean> {
  const store = useNotificationPermissionStore.getState();
  if (await store.refresh()) return true;
  if (!useNotificationPermissionStore.getState().canAskAgain) return false;
  const { granted, canAskAgain } =
    await Notifications.requestPermissionsAsync();
  useNotificationPermissionStore.setState({ granted, canAskAgain });
  return granted;
}

/** The permission, checked again whenever the app comes back to the front. */
export function useNotificationPermission() {
  const granted = useNotificationPermissionStore((state) => state.granted);
  const request = useNotificationPermissionStore((state) => state.request);
  useEffect(() => {
    const refresh = () =>
      void useNotificationPermissionStore
        .getState()
        .refresh()
        .catch(() => {});
    refresh();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    return () => subscription.remove();
  }, []);
  return { granted, request };
}
