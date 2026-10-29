import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import type { StateStorage } from "zustand/middleware";

import { configurePlatform } from "@personal/shared/platform";

/**
 * The backend origin. `EXPO_PUBLIC_API_URL` wins; in development it defaults
 * to the machine running the Expo dev server (port 8000), which the phone
 * already reaches over the LAN.
 */
function resolveApiBaseUrl(): string {
  const explicit = process.env.EXPO_PUBLIC_API_URL;
  if (explicit) return explicit;
  const devHost = Constants.expoConfig?.hostUri?.split(":")[0];
  return devHost ? `http://${devHost}:8000` : "http://localhost:8000";
}

/** Tokens go to the Keychain / Keystore, never to plain storage. */
const secureStorage: StateStorage = {
  getItem: (name) => SecureStore.getItemAsync(name),
  setItem: (name, value) => SecureStore.setItemAsync(name, value),
  removeItem: (name) => SecureStore.deleteItemAsync(name),
};

// The saved query cache outgrows secure storage's value size limit and holds
// no credentials, so it goes to plain app storage.
configurePlatform({
  apiBaseUrl: resolveApiBaseUrl(),
  storage: secureStorage,
  cacheStorage: AsyncStorage,
});
