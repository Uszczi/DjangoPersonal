import { Stack, router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";

import { useFolders } from "@personal/shared/queries/folders";

import { common } from "@/ui/classes";
import { ScreenHeader } from "@/ui/ScreenHeader";
import { FolderContents } from "@/features/notes/FolderContents";
import { NotatnikActionsSheet } from "@/features/notes/NotatnikActionsSheet";

/** One Folder of the Notatnik: its subfolders and items, and its own options. */
export default function FolderScreen() {
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const id = rawId;
  const { data: folders, isPending } = useFolders();
  const folder = folders?.find((item) => item.id === id);
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);
  const [actionError, setActionError] = useState("");

  if (!folder) {
    return (
      <View className={common.center}>
        <Text className={common.muted}>
          {isPending ? "Wczytywanie…" : "Nie znaleziono folderu."}
        </Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          header: () => (
            <ScreenHeader
              title={folder.name}
              actions={[
                {
                  icon: "ellipsis-vertical",
                  accessibilityLabel: "Opcje folderu",
                  onPress: () => setIsOptionsOpen(true),
                },
              ]}
            />
          ),
        }}
      />
      {actionError !== "" && (
        <Text className={common.error}>{actionError}</Text>
      )}
      <FolderContents folderId={folder.id} />
      {isOptionsOpen && (
        <NotatnikActionsSheet
          target={{ type: "folder", folder }}
          onClose={() => setIsOptionsOpen(false)}
          onError={setActionError}
          onDeleted={() => router.back()}
        />
      )}
    </>
  );
}
