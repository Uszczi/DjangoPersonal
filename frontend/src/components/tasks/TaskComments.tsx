import { ImagePlus, Paperclip, X } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type FormEvent,
} from "react";

import { apiErrorMessage } from "@personal/shared/apiErrorMessage";
import type {
  CommentAttachmentResponse,
  TaskCommentResponse,
  TaskResponse,
} from "@personal/shared/generated/api";
import {
  AttachmentUploadError,
  MAX_ATTACHMENT_BYTES,
  downloadAttachment,
  formatCommentTime,
  formatFileSize,
  useAddCommentAttachments,
  useAddTaskComment,
  useDeleteCommentAttachment,
  useDeleteTaskComment,
  useTaskComments,
  useUpdateTaskComment,
} from "@personal/shared/queries/taskComments";
import {
  Button,
  DeleteButton,
  ErrorAlert,
  Field,
  IconButton,
  LoadingStatus,
  TextArea,
} from "@/design-system";

/** The file's bytes as an object URL, loaded with the user's token. */
function useAttachmentUrl(attachment: CommentAttachmentResponse) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    downloadAttachment(attachment)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attachment]);
  return { url, failed };
}

function AttachmentImage({
  attachment,
}: {
  attachment: CommentAttachmentResponse;
}) {
  const { url, failed } = useAttachmentUrl(attachment);
  const [expanded, setExpanded] = useState(false);
  if (failed) {
    return (
      <span className="text-[12px] text-danger">
        Nie udało się wczytać: {attachment.fileName}
      </span>
    );
  }
  if (!url) {
    return (
      <span className="inline-block h-24 w-24 animate-pulse rounded-md bg-wash" />
    );
  }
  return (
    <button
      type="button"
      className="cursor-zoom-in rounded-md border border-line-soft p-0"
      onClick={() => setExpanded((current) => !current)}
      aria-label={`${expanded ? "Zmniejsz" : "Powiększ"} zdjęcie: ${attachment.fileName}`}
      aria-expanded={expanded}
    >
      <img
        src={url}
        alt={attachment.fileName}
        className={
          expanded
            ? "block max-h-[80vh] max-w-full rounded-md"
            : "block h-24 w-24 rounded-md object-cover"
        }
      />
    </button>
  );
}

async function saveFile(attachment: CommentAttachmentResponse) {
  const blob = await downloadAttachment(attachment);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = attachment.fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function AttachmentList({ comment }: { comment: TaskCommentResponse }) {
  const deleteAttachment = useDeleteCommentAttachment(comment.taskId);
  if (comment.attachments.length === 0) return null;
  const images = comment.attachments.filter((item) => item.isImage);
  const files = comment.attachments.filter((item) => !item.isImage);
  return (
    <div className="mt-2 flex flex-col gap-2">
      {images.length > 0 && (
        <div className="flex flex-wrap items-start gap-2">
          {images.map((attachment) => (
            <AttachmentImage key={attachment.id} attachment={attachment} />
          ))}
        </div>
      )}
      {files.map((attachment) => (
        <div key={attachment.id} className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => void saveFile(attachment)}>
            <Paperclip size={14} aria-hidden />
            {attachment.fileName} · {formatFileSize(attachment.size)}
          </Button>
          <DeleteButton
            aria-label={`Usuń plik: ${attachment.fileName}`}
            onClick={() => {
              if (window.confirm(`Usunąć plik „${attachment.fileName}”?`)) {
                deleteAttachment.mutate(attachment);
              }
            }}
          />
        </div>
      ))}
    </div>
  );
}

/** Files within the server's size limit, and a message naming the rest. */
function checkSizes(picked: Iterable<File>) {
  const accepted: File[] = [];
  const tooBig: string[] = [];
  for (const file of picked) {
    if (file.size > MAX_ATTACHMENT_BYTES) tooBig.push(file.name);
    else accepted.push(file);
  }
  const error =
    tooBig.length > 0
      ? `Za duży plik (maks. ${formatFileSize(MAX_ATTACHMENT_BYTES)}): ${tooBig.join(", ")}`
      : "";
  return { accepted, error };
}

function CommentItem({ comment }: { comment: TaskCommentResponse }) {
  const updateComment = useUpdateTaskComment();
  const deleteComment = useDeleteTaskComment();
  const addAttachments = useAddCommentAttachments(comment.taskId);
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement | null>(null);

  async function attach(picked: File[]) {
    const { accepted, error: sizeError } = checkSizes(picked);
    setError(sizeError);
    if (accepted.length === 0) return;
    try {
      await addAttachments.mutateAsync({ comment, files: accepted });
    } catch (caught) {
      const reason =
        caught instanceof AttachmentUploadError ? caught.reason : caught;
      setError(`Nie udało się wysłać plików: ${await apiErrorMessage(reason)}`);
    }
  }

  async function save() {
    if (draft === null) return;
    setError("");
    try {
      await updateComment.mutateAsync({ comment, body: draft.trim() });
      setDraft(null);
    } catch (caught) {
      setError(await apiErrorMessage(caught));
    }
  }

  async function remove() {
    if (!window.confirm("Usunąć komentarz razem z jego plikami?")) return;
    setError("");
    try {
      await deleteComment.mutateAsync(comment);
    } catch (caught) {
      setError(await apiErrorMessage(caught));
    }
  }

  return (
    <li className="border-b border-row-line py-3 last:border-b-0">
      <div className="flex items-center gap-2">
        <time
          className="text-[12px] text-muted"
          dateTime={comment.createdAt.toISOString()}
        >
          {formatCommentTime(comment.createdAt)}
        </time>
        <span className="ml-auto flex items-center gap-1">
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            data-testid={`comment-${comment.id}-file-input`}
            onChange={(event) => {
              void attach(Array.from(event.target.files ?? []));
              event.target.value = "";
            }}
          />
          <IconButton
            className="text-[18px]"
            title="Dodaj zdjęcia"
            aria-label="Dodaj zdjęcia do komentarza"
            onClick={() => fileInput.current?.click()}
            disabled={addAttachments.isPending}
          >
            <ImagePlus size={16} aria-hidden />
          </IconButton>
          {draft === null && (
            <Button
              variant="ghost"
              aria-label="Edytuj komentarz"
              onClick={() => setDraft(comment.body)}
            >
              Edytuj
            </Button>
          )}
          <DeleteButton
            aria-label="Usuń komentarz"
            onClick={() => void remove()}
            disabled={deleteComment.isPending}
          />
        </span>
      </div>
      {draft === null ? (
        comment.body && (
          <p className="mt-1 whitespace-pre-wrap break-words text-[14px] text-ink">
            {comment.body}
          </p>
        )
      ) : (
        <div className="mt-1">
          <TextArea
            aria-label="Treść komentarza"
            rows={3}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDraft(null)}>
              Anuluj
            </Button>
            <Button
              onClick={() => void save()}
              disabled={updateComment.isPending}
            >
              Zapisz
            </Button>
          </div>
        </div>
      )}
      <AttachmentList comment={comment} />
      {addAttachments.isPending && (
        <LoadingStatus variant="inline">Wysyłanie plików…</LoadingStatus>
      )}
      {error && <ErrorAlert>{error}</ErrorAlert>}
    </li>
  );
}

/** A picked file waiting to be sent; `preview` is an object URL for pictures. */
type PendingUpload = { file: File; preview: string | null };

function pendingUpload(file: File): PendingUpload {
  return {
    file,
    preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
  };
}

function releasePreviews(pending: PendingUpload[]) {
  for (const item of pending) {
    if (item.preview) URL.revokeObjectURL(item.preview);
  }
}

function PendingFile({
  pending,
  onRemove,
}: {
  pending: PendingUpload;
  onRemove: () => void;
}) {
  return (
    <li className="relative flex items-center gap-2 rounded-md border border-line-soft p-1 pr-8 text-[12px] text-ink-soft">
      {pending.preview ? (
        <img
          src={pending.preview}
          alt=""
          className="h-12 w-12 rounded object-cover"
        />
      ) : (
        <Paperclip size={14} aria-hidden />
      )}
      <span className="max-w-[160px] truncate">{pending.file.name}</span>
      <IconButton
        className="absolute right-0 top-0 text-[16px]"
        aria-label={`Nie dołączaj: ${pending.file.name}`}
        onClick={onRemove}
      >
        <X size={14} />
      </IconButton>
    </li>
  );
}

function NewCommentForm({ task }: { task: TaskResponse }) {
  const addComment = useAddTaskComment(task.id);
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<PendingUpload[]>([]);
  const filesRef = useRef(files);
  useEffect(() => {
    filesRef.current = files;
  }, [files]);
  // Free the previews still listed when the editor closes.
  useEffect(() => () => releasePreviews(filesRef.current), []);
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement | null>(null);

  function addFiles(picked: Iterable<File>) {
    const { accepted, error: sizeError } = checkSizes(picked);
    setFiles((current) => [...current, ...accepted.map(pendingUpload)]);
    setError(sizeError);
  }

  function clearFiles() {
    releasePreviews(files);
    setFiles([]);
  }

  function removeFile(index: number) {
    releasePreviews(files.slice(index, index + 1));
    setFiles((current) => current.filter((_, i) => i !== index));
  }

  function handlePaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const pasted = Array.from(event.clipboardData.files);
    if (pasted.length === 0) return;
    event.preventDefault();
    addFiles(pasted);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = body.trim();
    if (!text && files.length === 0) {
      setError("Napisz komentarz albo dołącz zdjęcie.");
      return;
    }
    setError("");
    try {
      await addComment.mutateAsync({
        body: text,
        files: files.map((item) => item.file),
      });
      setBody("");
      clearFiles();
    } catch (caught) {
      if (caught instanceof AttachmentUploadError) {
        // The comment is saved; only some files are missing from it.
        setBody("");
        clearFiles();
        setError(
          `Komentarz zapisany, ale nie udało się wysłać plików (${caught.failed}): ${await apiErrorMessage(caught.reason)}`,
        );
      } else {
        setError(await apiErrorMessage(caught));
      }
    }
  }

  const isSending = addComment.isPending;
  return (
    <form onSubmit={handleSubmit} className="mt-3">
      <Field label="Nowy komentarz">
        <TextArea
          rows={3}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          onPaste={handlePaste}
          disabled={isSending}
        />
      </Field>
      {files.length > 0 && (
        <ul
          className="mb-2 flex flex-wrap gap-2"
          aria-label="Pliki do dołączenia"
        >
          {files.map((pending, index) => (
            <PendingFile
              key={pending.preview ?? `${pending.file.name}-${index}`}
              pending={pending}
              onRemove={() => removeFile(index)}
            />
          ))}
        </ul>
      )}
      {error && <ErrorAlert>{error}</ErrorAlert>}
      <div className="flex items-center gap-2">
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          data-testid="comment-file-input"
          onChange={(event) => {
            addFiles(Array.from(event.target.files ?? []));
            event.target.value = "";
          }}
        />
        <Button
          variant="secondary"
          onClick={() => fileInput.current?.click()}
          disabled={isSending}
        >
          <ImagePlus size={16} aria-hidden />
          Dodaj zdjęcia
        </Button>
        <Button type="submit" className="ml-auto" disabled={isSending}>
          {isSending ? "Wysyłanie…" : "Dodaj komentarz"}
        </Button>
      </div>
    </form>
  );
}

/** A Task's comments, oldest first, and the form to add one. */
export function TaskComments({ task }: { task: TaskResponse }) {
  const { data: comments, isPending, isError } = useTaskComments(task.id);
  return (
    <section aria-labelledby="task-comments-title" className="mt-6">
      <h3
        id="task-comments-title"
        className="text-[12px] font-semibold uppercase tracking-wide text-muted"
      >
        Komentarze
      </h3>
      {isPending ? (
        <LoadingStatus variant="inline">Wczytywanie komentarzy…</LoadingStatus>
      ) : isError ? (
        <ErrorAlert>Nie udało się wczytać komentarzy.</ErrorAlert>
      ) : comments.length === 0 ? (
        <p className="mt-2 text-[13px] text-muted">Brak komentarzy.</p>
      ) : (
        <ul className="mt-1">
          {comments.map((comment) => (
            <CommentItem key={comment.id} comment={comment} />
          ))}
        </ul>
      )}
      <NewCommentForm task={task} />
    </section>
  );
}
