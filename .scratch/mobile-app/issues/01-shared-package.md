Status: done

# 01: Shared package and npm workspaces

**What to build:** Turn the repository into an npm workspaces monorepo and move the DOM-free frontend code (generated API client, `api`, domain stores, pure helpers) into `packages/shared`. The web frontend imports it from `@personal/shared` and behaves exactly as before.

**Blocked by:** None (can start immediately).

- [x] Root `package.json` declares the workspaces `frontend`, `mobile`, `packages/*`; one root lockfile.
- [x] `packages/shared` holds the generated client, `api`, `platform`, the shared stores and helpers listed in the spec.
- [x] `configurePlatform` sets the API base URL and the persisted storage; web defaults are unchanged.
- [x] `just generate-api` writes the client into `packages/shared`.
- [x] The frontend Docker image still builds (verified by replaying its install/build steps in a clean copy; the Docker daemon was not available).
- [x] `npm test`, `npm run lint` and `npm run build` in `frontend/` pass.

## Implementation notes

- The generated client was moved with `git mv` (content unchanged): there is no Java runtime locally, so `just generate-api` could not be re-run. The next run writes into the new location.
- `api.ts` reads the base URL through a getter, because the generated `Configuration` reads `basePath` on every request and the host configures the platform after the module loads. The refresh call uses the same base URL.
- `logout` clears the persisted session with `persist.clearStorage()` instead of `localStorage.removeItem`.
