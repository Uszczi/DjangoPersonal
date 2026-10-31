import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { Image, Modal, Pressable, Text, TextInput, View } from "react-native";

import { refreshAccessToken } from "@personal/shared/api";
import { apiErrorMessage } from "@personal/shared/apiErrorMessage";
import type {
  CommentAttachmentResponse,
  TaskCommentResponse,
  TaskResponse,
} from "@personal/shared/generated/api";
import { apiBaseUrl } from "@personal/shared/platform";
import {
  AttachmentUploadError,
  MAX_ATTACHMENT_BYTES,
  formatCommentTime,
  formatFileSize,
  useAddCommentAttachments,
  useAddTaskComment,
  useDeleteTaskComment,
  useTaskComments,
  useUpdateTaskComment,
  type AttachmentUpload,
} from "@personal/shared/queries/taskComments";
import { useAuthStore } from "@personal/shared/stores/auth";

import { Button } from "@/ui/Button";
import { confirmDestructive } from "@/ui/confirm";
import { common, form } from "@/ui/classes";

const THUMBNAIL = "size-[88px] rounded-md bg-wash";
const COMMENT_INPUT =
  "min-h-[72px] rounded border border-control-border bg-input px-[11px] py-2.5 text-[14px] text-ink align-top";
const FORM_ACTIONS = "mt-2.5 flex-row gap-2";
const THUMBNAILS = "mt-1 flex-row flex-wrap gap-2";

/** A picked photo waiting to be sent: React Native uploads it from its file URI. */
type PendingPhoto = { uri: string; name: string; type: string };

function pendingPhoto(asset: ImagePicker.ImagePickerAsset): PendingPhoto {
  const type = asset.mimeType ?? "image/jpeg";
  const extension = type.split("/")[1] ?? "jpg";
  return {
    uri: asset.uri,
    name: asset.fileName ?? `zdjecie-${Date.now()}.${extension}`,
    type,
  };
}

/** Photos within the server's size limit, and a message about the rest. */
function checkSizes(assets: ImagePicker.ImagePickerAsset[]) {
  const tooBig = assets.filter(
    (asset) => (asset.fileSize ?? 0) > MAX_ATTACHMENT_BYTES,
  );
  return {
    photos: assets.filter((asset) => !tooBig.includes(asset)).map(pendingPhoto),
    error:
      tooBig.length > 0
        ? `Pominięto za duże zdjęcia (maks. ${formatFileSize(MAX_ATTACHMENT_BYTES)}).`
        : "",
  };
}

type Picked = { photos: PendingPhoto[]; error: string };

/** Photos from the library, as the original files. */
async function pickFromLibrary(): Promise<Picked> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsMultipleSelection: true,
    // The original file: no recompression, and on iOS no HEIC→JPEG copy.
    quality: 1,
    preferredAssetRepresentationMode:
      ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Current,
  });
  return result.canceled
    ? { photos: [], error: "" }
    : checkSizes(result.assets);
}

async function takePhoto(): Promise<Picked> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    return { photos: [], error: "Brak dostępu do aparatu." };
  }
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ["images"],
    quality: 1,
  });
  return result.canceled
    ? { photos: [], error: "" }
    : checkSizes(result.assets);
}

/** React Native's FormData sends a `{ uri, name, type }` file as is. */
function asUploads(photos: PendingPhoto[]): AttachmentUpload[] {
  return photos.map((photo) => photo as unknown as AttachmentUpload);
}

/**
 * The picture straight from the API: the native image loader sends the
 * access token itself. A token that expired meanwhile fails the load once;
 * the token is then refreshed and the new one reloads the picture.
 */
function useAttachmentSource(attachment: CommentAttachmentResponse) {
  const access = useAuthStore((state) => state.access);
  const [retried, setRetried] = useState(false);
  return {
    source: {
      uri: `${apiBaseUrl()}/api/v1/comment-attachments/${attachment.id}/`,
      headers: access ? { Authorization: `Bearer ${access}` } : undefined,
    },
    onError: () => {
      if (retried) return;
      setRetried(true);
      void refreshAccessToken();
    },
  };
}

function AttachmentImage({
  attachment,
  onOpen,
}: {
  attachment: CommentAttachmentResponse;
  onOpen: () => void;
}) {
  const { source, onError } = useAttachmentSource(attachment);
  return (
    <Pressable
      accessibilityRole="imagebutton"
      accessibilityLabel={`Powiększ zdjęcie: ${attachment.fileName}`}
      onPress={onOpen}
    >
      <Image source={source} onError={onError} className={THUMBNAIL} />
    </Pressable>
  );
}

function FullScreenImage({
  attachment,
  onClose,
}: {
  attachment: CommentAttachmentResponse;
  onClose: () => void;
}) {
  const { source, onError } = useAttachmentSource(attachment);
  return (
    <Modal visible animationType="fade" onRequestClose={onClose}>
      <Pressable
        className="flex-1 items-center justify-center bg-black"
        onPress={onClose}
        accessibilityLabel="Zamknij zdjęcie"
      >
        <Image
          source={source}
          onError={onError}
          className="size-full"
          resizeMode="contain"
        />
      </Pressable>
    </Modal>
  );
}

function CommentItem({ comment }: { comment: TaskCommentResponse }) {
  const updateComment = useUpdateTaskComment();
  const deleteComment = useDeleteTaskComment();
  const addAttachments = useAddCommentAttachments(comment.taskId);
  const [opened, setOpened] = useState<CommentAttachmentResponse | null>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState("");
  const images = comment.attachments.filter((item) => item.isImage);
  const files = comment.attachments.filter((item) => !item.isImage);

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

  async function attach(pick: () => Promise<Picked>) {
    const { photos, error: pickError } = await pick();
    setError(pickError);
    if (photos.length === 0) return;
    try {
      await addAttachments.mutateAsync({ comment, files: asUploads(photos) });
    } catch (caught) {
      const reason =
        caught instanceof AttachmentUploadError ? caught.reason : caught;
      setError(`Nie udało się wysłać zdjęć: ${await apiErrorMessage(reason)}`);
    }
  }

  async function remove() {
    const confirmed = await confirmDestructive(
      "Usunąć komentarz?",
      "Komentarz zostanie usunięty razem z jego plikami.",
      "Usuń komentarz",
    );
    if (!confirmed) return;
    try {
      await deleteComment.mutateAsync(comment);
    } catch (caught) {
      setError(await apiErrorMessage(caught));
    }
  }

  const isBusy =
    updateComment.isPending ||
    deleteComment.isPending ||
    addAttachments.isPending;
  return (
    <View className="gap-1.5 border-b border-row-line py-2.5">
      <View className="flex-row items-center justify-between">
        <Text className={common.muted}>
          {formatCommentTime(comment.createdAt)}
        </Text>
        <View className="flex-row gap-4">
          {draft === null && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Edytuj komentarz"
              onPress={() => setDraft(comment.body)}
              disabled={isBusy}
              hitSlop={8}
            >
              <Text className="text-xs font-semibold text-accent">Edytuj</Text>
            </Pressable>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Usuń komentarz"
            onPress={() => void remove()}
            disabled={isBusy}
            hitSlop={8}
          >
            <Text className="text-xs font-semibold text-danger">Usuń</Text>
          </Pressable>
        </View>
      </View>
      {draft === null ? (
        comment.body !== "" && (
          <Text className="text-sm text-ink">{comment.body}</Text>
        )
      ) : (
        <View>
          <TextInput
            className={COMMENT_INPUT}
            value={draft}
            onChangeText={setDraft}
            multiline
            autoFocus
            editable={!updateComment.isPending}
            placeholderTextColorClassName="accent-placeholder"
            accessibilityLabel="Treść komentarza"
          />
          <View className={FORM_ACTIONS}>
            <Button
              label="Galeria"
              variant="secondary"
              accessibilityLabel="Dodaj zdjęcia z galerii do komentarza"
              disabled={isBusy}
              onPress={() => void attach(pickFromLibrary)}
            />
            <Button
              label="Aparat"
              variant="secondary"
              accessibilityLabel="Zrób zdjęcie do komentarza"
              disabled={isBusy}
              onPress={() => void attach(takePhoto)}
            />
          </View>
          <View className={FORM_ACTIONS}>
            <Button
              label="Anuluj"
              variant="secondary"
              disabled={updateComment.isPending}
              onPress={() => setDraft(null)}
              className="ml-auto flex-1"
            />
            <Button
              label="Zapisz"
              isBusy={updateComment.isPending}
              onPress={() => void save()}
            />
          </View>
        </View>
      )}
      {images.length > 0 && (
        <View className={THUMBNAILS}>
          {images.map((attachment) => (
            <AttachmentImage
              key={attachment.id}
              attachment={attachment}
              onOpen={() => setOpened(attachment)}
            />
          ))}
        </View>
      )}
      {files.map((attachment) => (
        <Text key={attachment.id} className={common.muted}>
          📎 {attachment.fileName} · {formatFileSize(attachment.size)}
        </Text>
      ))}
      {addAttachments.isPending && (
        <Text className={common.muted}>Wysyłanie zdjęć…</Text>
      )}
      {error !== "" && <Text className={common.alert}>{error}</Text>}
      {opened && (
        <FullScreenImage attachment={opened} onClose={() => setOpened(null)} />
      )}
    </View>
  );
}

function NewCommentForm({ task }: { task: TaskResponse }) {
  const addComment = useAddTaskComment(task.id);
  const [body, setBody] = useState("");
  const [photos, setPhotos] = useState<PendingPhoto[]>([]);
  const [error, setError] = useState("");

  async function add(pick: () => Promise<Picked>) {
    const { photos: picked, error: pickError } = await pick();
    setPhotos((current) => [...current, ...picked]);
    setError(pickError);
  }

  async function submit() {
    const text = body.trim();
    if (!text && photos.length === 0) {
      setError("Napisz komentarz albo dołącz zdjęcie.");
      return;
    }
    setError("");
    try {
      await addComment.mutateAsync({
        body: text,
        files: asUploads(photos),
      });
      setBody("");
      setPhotos([]);
    } catch (caught) {
      if (caught instanceof AttachmentUploadError) {
        setBody("");
        setPhotos([]);
        setError(
          `Komentarz zapisany, ale nie udało się wysłać zdjęć (${caught.failed}): ${await apiErrorMessage(caught.reason)}`,
        );
      } else {
        setError(await apiErrorMessage(caught));
      }
    }
  }

  const isSending = addComment.isPending;
  return (
    <View>
      <Text className={form.label}>Nowy komentarz</Text>
      <TextInput
        className={COMMENT_INPUT}
        value={body}
        onChangeText={setBody}
        multiline
        editable={!isSending}
        placeholderTextColorClassName="accent-placeholder"
        accessibilityLabel="Nowy komentarz"
      />
      {photos.length > 0 && (
        <View className={THUMBNAILS}>
          {photos.map((photo, index) => (
            <View key={photo.uri}>
              <Image source={{ uri: photo.uri }} className={THUMBNAIL} />
              <Pressable
                className="absolute top-1 right-1 size-[22px] items-center justify-center rounded-full bg-overlay"
                accessibilityRole="button"
                accessibilityLabel={`Nie dołączaj: ${photo.name}`}
                onPress={() =>
                  setPhotos((current) => current.filter((_, i) => i !== index))
                }
                hitSlop={6}
              >
                <Text className="text-xs font-bold text-on-signal">✕</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}
      {error !== "" && <Text className={form.error}>{error}</Text>}
      <View className={FORM_ACTIONS}>
        <Button
          label="Galeria"
          variant="secondary"
          disabled={isSending}
          onPress={() => void add(pickFromLibrary)}
        />
        <Button
          label="Aparat"
          variant="secondary"
          disabled={isSending}
          onPress={() => void add(takePhoto)}
        />
        <Button
          label="Dodaj"
          accessibilityLabel="Dodaj komentarz"
          isBusy={isSending}
          onPress={() => void submit()}
          className="ml-auto flex-1"
        />
      </View>
    </View>
  );
}

/** A Task's comments, oldest first, and the form to add one with photos. */
export function TaskComments({ task }: { task: TaskResponse }) {
  const { data: comments, isPending, isError } = useTaskComments(task.id);
  return (
    <View className="mt-[26px] gap-1.5 border-t border-line pt-2.5">
      <Text className="mt-2.5 text-[13px] font-semibold text-ink-soft">
        Komentarze
      </Text>
      {isPending ? (
        <Text className={common.muted}>Wczytywanie komentarzy…</Text>
      ) : isError ? (
        <Text className={common.alert}>Nie udało się wczytać komentarzy.</Text>
      ) : comments.length === 0 ? (
        <Text className={common.muted}>Brak komentarzy.</Text>
      ) : (
        comments.map((comment) => (
          <CommentItem key={comment.id} comment={comment} />
        ))
      )}
      <NewCommentForm task={task} />
    </View>
  );
}
