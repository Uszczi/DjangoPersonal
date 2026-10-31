/**
 * The account's mobile settings as server state: which bottom tabs are hidden.
 * `useTabBarStore.hidden` keeps this device's copy of it (persisted only so
 * startup and the sign-in screens paint the last known bar); these hooks are
 * the only writers of that copy while signed in, so the server's choice made
 * on any device wins.
 */
import { useEffect } from "react";
import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { api } from "@personal/shared/api";
import type { MobileSettingsResponse } from "@personal/shared/generated/api";
import { useAuthStore } from "@personal/shared/stores/auth";

import { useTabBarStore } from "@/features/tabs/tabBar";

export const mobileSettingsKeys = {
  all: ["mobileSettings"] as const,
};

export const mobileSettingsQuery = queryOptions({
  queryKey: mobileSettingsKeys.all,
  queryFn: ({ signal }) => api.mobileSettingsRetrieve({ signal }),
});

export function useMobileSettings() {
  return useQuery(mobileSettingsQuery);
}

/**
 * Load the account's hidden tabs while signed in and copy them onto this
 * device's tab bar, so the server's choice (made on any device) wins over the
 * local copy. Mount once, at the app's root.
 */
export function useHiddenTabsSync() {
  const signedIn = useAuthStore((state) => state.access !== null);
  const { data } = useQuery({ ...mobileSettingsQuery, enabled: signedIn });
  const hiddenTabs = data?.hiddenTabs;
  useEffect(() => {
    if (hiddenTabs !== undefined) {
      useTabBarStore.getState().setHidden(hiddenTabs);
    }
  }, [hiddenTabs]);
}

/**
 * Save the account's hidden tabs. The switch is optimistic (the cache and this
 * device's copy change at once) and rolls back if the server refuses.
 */
export function useUpdateHiddenTabs() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (hiddenTabs: string[]) =>
      api.mobileSettingsPartialUpdate({
        patchedMobileSettingsRequest: { hiddenTabs },
      }),
    onMutate: async (hiddenTabs) => {
      await queryClient.cancelQueries({ queryKey: mobileSettingsQuery.queryKey });
      const previous = queryClient.getQueryData(mobileSettingsQuery.queryKey);
      const previousHidden = useTabBarStore.getState().hidden;
      queryClient.setQueryData(
        mobileSettingsQuery.queryKey,
        (settings): MobileSettingsResponse => ({ ...settings, hiddenTabs }),
      );
      useTabBarStore.getState().setHidden(hiddenTabs);
      return { previous, previousHidden };
    },
    onError: (_error, _hiddenTabs, context) => {
      if (!context) return;
      if (context.previous) {
        queryClient.setQueryData(mobileSettingsQuery.queryKey, context.previous);
      }
      useTabBarStore.getState().setHidden(context.previousHidden);
      // With nothing cached to restore, ask the server what's hidden.
      void queryClient.invalidateQueries({ queryKey: mobileSettingsQuery.queryKey });
    },
    onSuccess: (settings) => {
      queryClient.setQueryData(mobileSettingsQuery.queryKey, settings);
    },
  });
}
