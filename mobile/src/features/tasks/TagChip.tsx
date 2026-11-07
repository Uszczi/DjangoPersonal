import { Text, View } from "react-native";

import type { TagResponse } from "@personal/shared/generated/api";

/** A Tag as a small chip, like the web: its colour as a dot, then its name. */
export function TagChip({ tag }: { tag: TagResponse }) {
  return (
    <View className="flex-row items-center gap-1 rounded-full bg-wash px-2 py-0.5">
      <TagDot color={tag.color} />
      <Text className="text-[11px] font-medium text-ink-soft" numberOfLines={1}>
        {tag.name}
      </Text>
    </View>
  );
}

/** The Tag's colour comes from data, so it stays in `style`. */
export function TagDot({ color }: { color: string }) {
  return (
    <View className="size-2 rounded-full" style={{ backgroundColor: color }} />
  );
}
