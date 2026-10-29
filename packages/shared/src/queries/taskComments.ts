/**
 * A Task's comments as server state, and the writes on them. A comment's
 * files are uploaded one request each, after the comment itself exists, so a
 * large file never holds up the text and one failed upload loses nothing else.
 */
import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { api } from "../api";
import type {
  CommentAttachmentResponse,
  TaskCommentResponse,
} from "../generated/api";
import { taskCommentKeys } from "./keys";

/**
 * A file to attach. On the web a `File`; React Native's `FormData` takes a
 * `{ uri, name, type }` object instead, passed through this type.
 */
export type AttachmentUpload = Blob;

/** The largest file the server accepts, to refuse bigger ones before sending. */
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

export const taskCommentsQuery = (taskId: number) =>
  queryOptions({
    queryKey: taskCommentKeys.task(taskId),
    queryFn: ({ signal }) => api.taskCommentsList({ task: taskId }, { signal }),
  });

export function useTaskComments(taskId: number) {
  return useQuery(taskCommentsQuery(taskId));
}

/** The file's bytes, as uploaded. */
export function downloadAttachment(attachment: CommentAttachmentResponse) {
  return api.commentAttachmentsRetrieve({ id: attachment.id });
}

/** "2,4 MB"-style size for a file listing. */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const digits = value < 10 ? 1 : 0;
  return `${value.toFixed(digits).replace(".", ",")} ${units[unit]}`;
}

/** Thrown when the comment was saved but some of its files were not. */
export class AttachmentUploadError extends Error {
  /** How many files were not saved. */
  readonly failed: number;
  /** The first upload's error, for its message. */
  readonly reason: unknown;

  constructor(failed: number, reason: unknown) {
    super("Some attachments were not uploaded.");
    this.failed = failed;
    this.reason = reason;
  }
}

async function uploadAll(commentId: number, files: AttachmentUpload[]) {
  let failed = 0;
  let firstError: unknown = null;
  for (const file of files) {
    try {
      await api.taskCommentsAttachmentsCreate({ id: commentId, file });
    } catch (error) {
      failed += 1;
      firstError ??= error;
    }
  }
  if (failed > 0) throw new AttachmentUploadError(failed, firstError);
}

/** Comment on a Task, then attach `files` to the comment. */
export function useAddTaskComment(taskId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      body,
      files = [],
    }: {
      body: string;
      files?: AttachmentUpload[];
    }) => {
      const comment = await api.taskCommentsCreate({
        taskCommentCreateRequest: { task: taskId, body },
      });
      await uploadAll(comment.id, files);
      return comment;
    },
    // Reloaded even after a failed upload: the comment and the files that
    // made it are saved.
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: taskCommentKeys.task(taskId),
      }),
  });
}

/** Attach more files to a comment that already exists. */
export function useAddCommentAttachments(taskId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      comment,
      files,
    }: {
      comment: TaskCommentResponse;
      files: AttachmentUpload[];
    }) => uploadAll(comment.id, files),
    // Reloaded even after a failed upload: the files that made it are saved.
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: taskCommentKeys.task(taskId),
      }),
  });
}

export function useUpdateTaskComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      comment,
      body,
    }: {
      comment: TaskCommentResponse;
      body: string;
    }) =>
      api.taskCommentsPartialUpdate({
        id: comment.id,
        patchedTaskCommentRequest: { body },
      }),
    onSuccess: (saved) =>
      queryClient.setQueryData(
        taskCommentKeys.task(saved.taskId),
        (comments: TaskCommentResponse[] | undefined) =>
          comments?.map((item) => (item.id === saved.id ? saved : item)),
      ),
  });
}

export function useDeleteTaskComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (comment: TaskCommentResponse) =>
      api.taskCommentsDestroy({ id: comment.id }),
    onSuccess: (_, comment) =>
      queryClient.setQueryData(
        taskCommentKeys.task(comment.taskId),
        (comments: TaskCommentResponse[] | undefined) =>
          comments?.filter((item) => item.id !== comment.id),
      ),
  });
}

export function useDeleteCommentAttachment(taskId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (attachment: CommentAttachmentResponse) =>
      api.commentAttachmentsDestroy({ id: attachment.id }),
    onSuccess: (_, attachment) =>
      queryClient.setQueryData(
        taskCommentKeys.task(taskId),
        (comments: TaskCommentResponse[] | undefined) =>
          comments?.map((comment) =>
            comment.id === attachment.commentId
              ? {
                  ...comment,
                  attachments: comment.attachments.filter(
                    (item) => item.id !== attachment.id,
                  ),
                }
              : comment,
          ),
      ),
  });
}

/** When a comment was written, e.g. "29 paź 2026, 14:05". */
export function formatCommentTime(date: Date): string {
  return date.toLocaleString("pl-PL", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
