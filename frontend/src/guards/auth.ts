import { redirect } from "@tanstack/react-router";

import { useAuthStore } from "@personal/shared/stores/auth";

/**
 * Route guard that redirects unauthenticated users away from protected pages
 * and authenticated users away from the auth pages (/login, /register).
 */
export function authGuard({ location }: { location: { pathname: string } }) {
  const user = useAuthStore.getState().user;
  const path = location.pathname;
  const isAuthPage = path === "/login" || path === "/register";

  if (!user && !isAuthPage) {
    throw redirect({ to: "/login" });
  }
  if (user && isAuthPage) {
    throw redirect({ to: "/" });
  }
}