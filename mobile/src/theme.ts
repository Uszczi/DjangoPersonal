import { Platform, StyleSheet } from "react-native";

/**
 * The web's design tokens (the `@theme` block of `frontend/src/index.css`),
 * so both clients share one look. Keep the two in step.
 */
export const colors = {
  /** Page background (web `canvas`). */
  background: "#e9eff0",
  /** Cards and sheets (web `paper`). */
  surface: "#f8faf7",
  /** Form controls. */
  input: "#ffffff",
  wash: "#f0f4f1",
  border: "#d2ddda",
  borderSoft: "#e1e8e3",
  rowLine: "#dce5e1",
  controlBorder: "#cbd7d3",
  controlBorderHover: "#9db0ad",
  text: "#1b3439",
  textSoft: "#344d52",
  deepInk: "#18343b",
  muted: "#6c8082",
  hint: "#718487",
  icon: "#64797c",
  iconWash: "#eaf0ed",
  accent: "#477c7c",
  /** The web's `signal`: primary buttons, the logo, active choices. */
  primary: "#d45b3e",
  primaryPale: "#f5e3dc",
  onPrimary: "#ffffff",
  danger: "#a23a28",
  dangerPale: "#fff0eb",
  dangerInk: "#873b2b",
  success: "#477c7c",
  chip: "#f0f4f1",
  /** The dark navigation bar (web Navbar). */
  navText: "#f4f7f4",
  navMuted: "#b5c6c6",
  navSelected: "#29474d",
};

/** The web's font roles; phones lack the web fonts, so each maps to a close system font. */
export const fonts = {
  display: Platform.select({ ios: "Trebuchet MS", default: undefined }),
  utility: Platform.select({ ios: "Menlo", default: "monospace" }),
};

export const common = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: colors.background,
  },
  error: { color: colors.danger, padding: 16, fontSize: 13 },
  muted: { color: colors.muted, fontSize: 12 },
  /** A list row (web `ListRow`): no card, a thin line underneath. */
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    minHeight: 62,
    marginHorizontal: 16,
    paddingHorizontal: 3,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.rowLine,
  },
  rowTitle: { fontSize: 14, fontWeight: "500", color: colors.text },
  rowSubtitle: { fontSize: 12, color: colors.muted, marginTop: 2 },
  /** Small all-caps line above a title (web `PageHeader` eyebrow). */
  eyebrow: {
    fontFamily: fonts.utility,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.9,
    color: colors.muted,
  },
  /** A page title (web `PageHeader`). */
  pageTitle: {
    fontFamily: fonts.display,
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: -0.5,
    color: colors.text,
  },
  pageHeader: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 8,
    gap: 4,
  },
  /** The boxed form error (web `ErrorAlert`). */
  alert: {
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    backgroundColor: colors.dangerPale,
    paddingHorizontal: 11,
    paddingVertical: 9,
    color: colors.dangerInk,
    fontSize: 12,
    lineHeight: 18,
  },
});

export const card = StyleSheet.create({
  /** A section card (web `TimerPanel`, `AuthCard`). */
  section: {
    marginHorizontal: 16,
    marginTop: 16,
    padding: 20,
    gap: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#dce4df",
    backgroundColor: colors.surface,
    shadowColor: "#1d3739",
    shadowOpacity: 0.06,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 1,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: -0.4,
    color: colors.text,
  },
  /** Small all-caps line in a card (web eyebrow); colour it `primary` to flag state. */
  kicker: {
    fontFamily: fonts.utility,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.9,
    color: colors.muted,
  },
});

export const form = StyleSheet.create({
  content: { padding: 20, gap: 8 },
  /** Field label (web `Field`). */
  label: {
    color: colors.textSoft,
    fontSize: 12,
    fontWeight: "600",
    marginTop: 10,
  },
  hint: { color: colors.hint, fontSize: 11 },
  input: {
    borderWidth: 1,
    borderColor: colors.controlBorder,
    borderRadius: 4,
    paddingHorizontal: 11,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: colors.input,
    color: colors.text,
  },
  multiline: { minHeight: 96, textAlignVertical: "top" },
  error: { color: colors.dangerInk, marginTop: 8, fontSize: 12 },
  /** The footer of an editor (web `ModalFooter`): a line above the buttons. */
  actions: {
    flexDirection: "row",
    gap: 9,
    marginTop: 26,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
  },
});

/** Shared screen options: the dark header of the web Navbar. */
export const headerOptions = {
  headerStyle: { backgroundColor: colors.deepInk },
  headerTintColor: colors.navText,
  headerTitleStyle: { fontWeight: "700" as const, fontSize: 16 },
  headerShadowVisible: false,
  contentStyle: { backgroundColor: colors.background },
};
