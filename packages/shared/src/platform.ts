import type { StateStorage } from "zustand/middleware";

/**
 * The one seam between the shared code and the app hosting it.
 *
 * The web app keeps the defaults: relative API URLs (so the Vite dev proxy and
 * the production nginx apply) and `localStorage`. The mobile app has neither,
 * so it calls `configurePlatform` at startup with the backend URL and a
 * secure-storage adapter, then rehydrates the persisted stores.
 */
export type PlatformConfig = {
  /** Origin of the backend, e.g. `http://192.168.1.10:8000`; "" means same origin. */
  apiBaseUrl: string;
  /** Where persisted stores (the auth tokens) are kept; may be async. */
  storage: StateStorage;
};

function memoryStorage(): StateStorage {
  const items = new Map<string, string>();
  return {
    getItem: (name) => items.get(name) ?? null,
    setItem: (name, value) => {
      items.set(name, value);
    },
    removeItem: (name) => {
      items.delete(name);
    },
  };
}

/** `localStorage` when the host has it (browsers, jsdom), in-memory otherwise. */
function defaultStorage(): StateStorage {
  try {
    if (typeof globalThis.localStorage !== "undefined") return globalThis.localStorage;
  } catch {
    // Storage access can throw (blocked site data); fall back to memory.
  }
  return memoryStorage();
}

let config: PlatformConfig = { apiBaseUrl: "", storage: defaultStorage() };

export function configurePlatform(overrides: Partial<PlatformConfig>): void {
  config = {
    ...config,
    ...overrides,
    apiBaseUrl: (overrides.apiBaseUrl ?? config.apiBaseUrl).replace(/\/+$/, ""),
  };
}

export function apiBaseUrl(): string {
  return config.apiBaseUrl;
}

/**
 * Storage that always delegates to the configured one. Persisted stores are
 * created at import time, before the host can configure anything, so they
 * hold this proxy instead of a concrete storage.
 */
export const platformStorage: StateStorage = {
  getItem: (name) => config.storage.getItem(name),
  setItem: (name, value) => config.storage.setItem(name, value),
  removeItem: (name) => config.storage.removeItem(name),
};
