import { focusManager } from "@tanstack/react-query";
import { AppState, Platform } from "react-native";

import { createQueryClient } from "@personal/shared/queries/client";

/** The mobile app's one server-state cache, provided in `app/_layout.tsx`. */
export const queryClient = createQueryClient();

// React Native has no window focus: coming back to the app counts as focus,
// so stale data refetches when the user returns (the web gets this for free).
focusManager.setEventListener((setFocused) => {
  if (Platform.OS === "web") return undefined;
  const subscription = AppState.addEventListener("change", (state) => {
    setFocused(state === "active");
  });
  return () => subscription.remove();
});
