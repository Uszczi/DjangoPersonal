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

import { Button } from "../../ui/Button";
import { confirmDestructive } from "../../ui/confirm";
import { makeStyles, useTheme } from "../../theme";

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
  const styles = useStyles();
  const { source, onError } = useAttachmentSource(attachment);
  return (
    <Pressable
      accessibilityRole="imagebutton"
      accessibilityLabel={`Powiększ zdjęcie: ${attachment.fileName}`}
      onPress={onOpen}
    >
      <Image source={source} onError={onError} style={styles.thumbnail} />
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
  const styles = useStyles();
  const { source, onError } = useAttachmentSource(attachment);
  return (
    <Modal visible animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={styles.viewer}
        onPress={onClose}
        accessibilityLabel="Zamknij zdjęcie"
      >
        <Image
          source={source}
          onError={onError}
          style={styles.viewerImage}
          resizeMode="contain"
        />
      </Pressable>
    </Modal>
  );
}

function CommentItem({ comment }: { comment: TaskCommentResponse }) {
  const { common, form, colors } = useTheme();
  const styles = useStyles();
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
    <View style={styles.comment}>
      <View style={styles.commentHeader}>
        <Text style={common.muted}>{formatCommentTime(comment.createdAt)}</Text>
        <View style={styles.commentActions}>
          {draft === null && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Edytuj komentarz"
              onPress={() => setDraft(comment.body)}
              disabled={isBusy}
              hitSlop={8}
            >
              <Text style={styles.actionLink}>Edytuj</Text>
            </Pressable>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Usuń komentarz"
            onPress={() => void remove()}
            disabled={isBusy}
            hitSlop={8}
          >
            <Text style={styles.deleteLink}>Usuń</Text>
          </Pressable>
        </View>
      </View>
      {draft === null ? (
        comment.body !== "" && <Text style={styles.body}>{comment.body}</Text>
      ) : (
        <View>
          <TextInput
            style={[form.input, styles.newComment]}
            value={draft}
            onChangeText={setDraft}
            multiline
            autoFocus
            editable={!updateComment.isPending}
            placeholderTextColor={colors.placeholder}
            accessibilityLabel="Treść komentarza"
          />
          <View style={styles.formActions}>
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
          <View style={styles.formActions}>
            <Button
              label="Anuluj"
              variant="secondary"
              disabled={updateComment.isPending}
              onPress={() => setDraft(null)}
              style={styles.submit}
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
        <View style={styles.thumbnails}>
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
        <Text key={attachment.id} style={common.muted}>
          📎 {attachment.fileName} · {formatFileSize(attachment.size)}
        </Text>
      ))}
      {addAttachments.isPending && (
        <Text style={common.muted}>Wysyłanie zdjęć…</Text>
      )}
      {error !== "" && <Text style={common.alert}>{error}</Text>}
      {opened && (
        <FullScreenImage attachment={opened} onClose={() => setOpened(null)} />
      )}
    </View>
  );
}

function NewCommentForm({ task }: { task: TaskResponse }) {
  const { form, colors } = useTheme();
  const styles = useStyles();
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
      <Text style={form.label}>Nowy komentarz</Text>
      <TextInput
        style={[form.input, styles.newComment]}
        value={body}
        onChangeText={setBody}
        multiline
        editable={!isSending}
        placeholderTextColor={colors.placeholder}
        accessibilityLabel="Nowy komentarz"
      />
      {photos.length > 0 && (
        <View style={styles.thumbnails}>
          {photos.map((photo, index) => (
            <View key={photo.uri}>
              <Image source={{ uri: photo.uri }} style={styles.thumbnail} />
              <Pressable
                style={styles.removePhoto}
                accessibilityRole="button"
                accessibilityLabel={`Nie dołączaj: ${photo.name}`}
                onPress={() =>
                  setPhotos((current) => current.filter((_, i) => i !== index))
                }
                hitSlop={6}
              >
                <Text style={styles.removePhotoLabel}>✕</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}
      {error !== "" && <Text style={form.error}>{error}</Text>}
      <View style={styles.formActions}>
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
          style={styles.submit}
        />
      </View>
    </View>
  );
}

/** A Task's comments, oldest first, and the form to add one with photos. */
export function TaskComments({ task }: { task: TaskResponse }) {
  const { common, form } = useTheme();
  const styles = useStyles();
  const { data: comments, isPending, isError } = useTaskComments(task.id);
  return (
    <View style={styles.section}>
      <Text style={[form.label, styles.heading]}>Komentarze</Text>
      {isPending ? (
        <Text style={common.muted}>Wczytywanie komentarzy…</Text>
      ) : isError ? (
        <Text style={common.alert}>Nie udało się wczytać komentarzy.</Text>
      ) : comments.length === 0 ? (
        <Text style={common.muted}>Brak komentarzy.</Text>
      ) : (
        comments.map((comment) => (
          <CommentItem key={comment.id} comment={comment} />
        ))
      )}
      <NewCommentForm task={task} />
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  section: {
    marginTop: 26,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    gap: 6,
  },
  heading: { fontSize: 13 },
  comment: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.rowLine,
    gap: 6,
  },
  commentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  commentActions: { flexDirection: "row", gap: 16 },
  actionLink: { color: colors.accent, fontSize: 12, fontWeight: "600" },
  deleteLink: { color: colors.danger, fontSize: 12, fontWeight: "600" },
  body: { color: colors.ink, fontSize: 14, lineHeight: 20 },
  thumbnails: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  thumbnail: {
    width: 88,
    height: 88,
    borderRadius: 6,
    backgroundColor: colors.wash,
  },
  removePhoto: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.overlay,
  },
  removePhotoLabel: { color: colors.onSignal, fontSize: 12, fontWeight: "700" },
  newComment: { minHeight: 72, textAlignVertical: "top" },
  formActions: { flexDirection: "row", gap: 8, marginTop: 10 },
  submit: { marginLeft: "auto" },
  viewer: {
    flex: 1,
    backgroundColor: "black",
    alignItems: "center",
    justifyContent: "center",
  },
  viewerImage: { width: "100%", height: "100%" },
}));
