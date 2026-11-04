import { Directory, File, Paths } from "expo-file-system";
import { useEffect, useState } from "react";

import { refreshAccessToken } from "@personal/shared/api";
import { apiBaseUrl } from "@personal/shared/platform";
import { useAuthStore } from "@personal/shared/stores/auth";

/**
 * Comment Attachments downloaded to the app's cache, shown from there.
 *
 * `<Image source={{ uri, headers }}>` cannot be trusted with the access
 * token: in Expo Go the native image loader drops the headers, so every
 * picture got a 401 and stayed blank. The files are downloaded with the
 * token instead, once each: an Attachment never changes.
 */
const DIRECTORY = new Directory(Paths.cache, "comment-attachments");

function cachedFile(id: string) {
  return new File(DIRECTORY, String(id));
}

/** The cached copy's URI, or `null` before it is downloaded. */
export function cachedAttachmentUri(id: string): string | null {
  const file = cachedFile(id);
  return file.exists ? file.uri : null;
}

async function downloadWith(id: string, access: string | null) {
  // A failed download can leave a partial file on Android, so it lands
  // under another name and moves into place only once complete.
  const partial = new File(DIRECTORY, `${id}.part`);
  const file = await File.downloadFileAsync(
    `${apiBaseUrl()}/api/v1/comment-attachments/${id}/`,
    partial,
    {
      headers: access ? { Authorization: `Bearer ${access}` } : {},
      idempotent: true,
    },
  );
  const target = cachedFile(id);
  if (target.exists) target.delete();
  await file.move(target);
  return target.uri;
}

async function download(id: string): Promise<string> {
  DIRECTORY.create({ intermediates: true, idempotent: true });
  try {
    return await downloadWith(id, useAuthStore.getState().access);
  } catch (error) {
    // The message carries the status: an expired token is refreshed once.
    if (!String(error).includes("401")) throw error;
    const access = await refreshAccessToken();
    if (access === null) throw error;
    return downloadWith(id, access);
  }
}

/** One download per Attachment, however many views ask for it at once. */
const pending = new Map<string, Promise<string>>();

function attachmentUri(id: string): Promise<string> {
  let request = pending.get(id);
  if (request === undefined) {
    request = download(id).finally(() => pending.delete(id));
    pending.set(id, request);
  }
  return request;
}

/** The local URI of an Attachment's file, downloading it on first use. */
export function useAttachmentUri(id: string) {
  const [uri, setUri] = useState(() => cachedAttachmentUri(id));
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (uri !== null) return;
    let cancelled = false;
    attachmentUri(id).then(
      (downloaded) => {
        if (!cancelled) setUri(downloaded);
      },
      () => {
        if (!cancelled) setFailed(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [id, uri]);

  return { uri, failed };
}
