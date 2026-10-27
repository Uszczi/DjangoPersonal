import { StyleSheet } from "react-native";

export const colors = {
  background: "#f8fafc",
  surface: "#ffffff",
  border: "#e2e8f0",
  text: "#0f172a",
  muted: "#64748b",
  primary: "#2563eb",
  onPrimary: "#ffffff",
  danger: "#dc2626",
  success: "#15803d",
  chip: "#f1f5f9",
};

export const common = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  error: { color: colors.danger, padding: 16 },
  muted: { color: colors.muted },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
});

export const card = StyleSheet.create({
  section: {
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    gap: 8,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  title: { fontSize: 18, fontWeight: "700", color: colors.text },
  kicker: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    color: colors.muted,
  },
});

export const form = StyleSheet.create({
  content: { padding: 16, gap: 8 },
  label: { color: colors.muted, fontSize: 13, marginTop: 8 },
  hint: { color: colors.muted, fontSize: 12 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: colors.surface,
    color: colors.text,
  },
  multiline: { minHeight: 96, textAlignVertical: "top" },
  error: { color: colors.danger, marginTop: 8 },
  actions: { flexDirection: "row", gap: 12, marginTop: 16 },
});
