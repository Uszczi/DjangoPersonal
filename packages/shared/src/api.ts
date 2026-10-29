import { Configuration, PersonalApi } from "./generated/api";
import type { Middleware } from "./generated/api/runtime";
import { apiBaseUrl } from "./platform";

/**
 * The single API client shared by every store. The backend exposes all
 * operations under one OpenAPI tag, so the generated client is one class.
 * The base URL comes from `configurePlatform`: "" on the web keeps requests
 * relative (so the Vite dev proxy applies); the mobile app sets the backend
 * origin.
 */

type AuthStoreModule = typeof import("./stores/auth");

let authStorePromise: Promise<AuthStoreModule> | null = null;
function loadAuthStore() {
  if (authStorePromise === null) {
    authStorePromise = import("./stores/auth");
  }
  return authStorePromise;
}

const AUTH_ENDPOINTS = ["/auth/login/", "/auth/register/", "/auth/refresh/"];

function isAuthEndpoint(url: string) {
  return AUTH_ENDPOINTS.some((endpoint) => url.includes(endpoint));
}

const authMiddleware: Middleware = {
  pre: async (context) => {
    const { useAuthStore } = await loadAuthStore();
    const access = useAuthStore.getState().access;
    if (!access) return;

    const headers = new Headers(context.init.headers);
    headers.set("Authorization", `Bearer ${access}`);
    return { url: context.url, init: { ...context.init, headers } };
  },
  post: async (context) => {
    if (context.response.status !== 401) return;
    if (isAuthEndpoint(context.url)) return;

    const access = await refreshAccessToken();
    if (access === null) return context.response;
    const headers = new Headers(context.init.headers);
    headers.set("Authorization", `Bearer ${access}`);
    return await fetch(context.url, { ...context.init, headers });
  },
};

let pendingRefresh: Promise<string | null> | null = null;

/**
 * Trade the refresh token for a new access token and store it; `null` (and a
 * sign-out) when that fails. Concurrent callers share one request. Exported
 * for requests made outside the generated client, such as an image the
 * mobile app loads by URL.
 */
export function refreshAccessToken(): Promise<string | null> {
  if (pendingRefresh === null) {
    pendingRefresh = doRefresh().finally(() => {
      pendingRefresh = null;
    });
  }
  return pendingRefresh;
}

async function doRefresh(): Promise<string | null> {
  const { useAuthStore } = await loadAuthStore();
  const refresh = useAuthStore.getState().refresh;
  if (!refresh) {
    useAuthStore.getState().logout();
    return null;
  }
  try {
    const refreshResponse = await fetch(
      `${apiBaseUrl()}/api/v1/auth/refresh/`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh }),
      },
    );
    if (!refreshResponse.ok) throw new Error("refresh failed");
    const data = (await refreshResponse.json()) as { access: string };
    useAuthStore.getState().applyTokens(data.access);
    return data.access;
  } catch {
    useAuthStore.getState().logout();
    return null;
  }
}

export const api = new PersonalApi(
  new Configuration({
    // A getter, because the generated Configuration reads basePath on every
    // request and the host may configure the platform after this module loads.
    get basePath() {
      return apiBaseUrl();
    },
    middleware: [authMiddleware],
  }),
);
