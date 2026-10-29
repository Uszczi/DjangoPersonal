/**
 * The account's settings as server state: one theme shared by every client
 * the account signs in from. `stores/theme` keeps this device's copy of it for
 * the first paint; these hooks are the only writers of that copy while signed
 * in.
 */
import { useEffect } from "react";
import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { api } from "../api";
import type { UserSettingsResponse } from "../generated/api";
import { useAuthStore } from "../stores/auth";
import { useThemeStore } from "../stores/theme";
import { toThemePreference, type ThemePreference } from "../themes";
import { settingsKeys } from "./keys";

export const settingsQuery = queryOptions({
  queryKey: settingsKeys.all,
  queryFn: ({ signal }) => api.settingsRetrieve({ signal }),
});

export function useUserSettings() {
  return useQuery(settingsQuery);
}

/**
 * Load the account's settings while signed in and copy the theme onto this
 * device, so the server's choice (made on any device) wins over the local
 * copy. Mount once, at the app's root.
 */
export function useAccountThemeSync() {
  const signedIn = useAuthStore((state) => state.access !== null);
  const { data } = useQuery({ ...settingsQuery, enabled: signedIn });
  const theme = data?.theme;
  useEffect(() => {
    if (theme !== undefined) {
      useThemeStore.getState().setPreference(toThemePreference(theme));
    }
  }, [theme]);
}

/**
 * Pick the account's theme. The switch is optimistic (the cache and this
 * device's copy change at once) and rolls back if the server refuses.
 */
export function useUpdateTheme() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (theme: ThemePreference) =>
      api.settingsPartialUpdate({ patchedUserSettingsRequest: { theme } }),
    onMutate: async (theme) => {
      await queryClient.cancelQueries({ queryKey: settingsQuery.queryKey });
      const previous = queryClient.getQueryData(settingsQuery.queryKey);
      const previousPreference = useThemeStore.getState().preference;
      queryClient.setQueryData(
        settingsQuery.queryKey,
        (settings): UserSettingsResponse => ({ ...settings, theme }),
      );
      useThemeStore.getState().setPreference(theme);
      return { previous, previousPreference };
    },
    onError: (_error, _theme, context) => {
      if (!context) return;
      if (context.previous) {
        queryClient.setQueryData(settingsQuery.queryKey, context.previous);
      }
      useThemeStore.getState().setPreference(context.previousPreference);
      // With nothing cached to restore, ask the server what the theme is.
      void queryClient.invalidateQueries({ queryKey: settingsQuery.queryKey });
    },
    onSuccess: (settings) => {
      queryClient.setQueryData(settingsQuery.queryKey, settings);
    },
  });
}
