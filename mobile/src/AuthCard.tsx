import { Link } from "expo-router";
import type { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";

import { Button } from "./Button";
import { card, colors, common, form } from "./theme";

/** The centred card the public account screens are drawn in (web `AuthCard`). */
export function AuthCard({
  title,
  error,
  canSubmit,
  isSubmitting,
  submitLabel,
  onSubmit,
  footer,
  children,
}: {
  title: string;
  error: string;
  canSubmit: boolean;
  isSubmitting: boolean;
  submitLabel: string;
  onSubmit: () => void;
  /** The line under the form linking to the other account screen. */
  footer: { text: string; href: "/login" | "/register"; label: string };
  /** The form's fields (`AuthField`s). */
  children: ReactNode;
}) {
  return (
    <KeyboardAvoidingView
      style={common.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[card.section, styles.card]}>
          <Text style={common.eyebrow}>KONTO</Text>
          <Text style={[common.pageTitle, styles.title]}>{title}</Text>
          {children}
          {error !== "" && <Text style={styles.error}>{error}</Text>}
          <View style={styles.actions}>
            <Button
              label={submitLabel}
              disabled={!canSubmit}
              isBusy={isSubmitting}
              onPress={onSubmit}
              style={styles.submit}
            />
          </View>
          <Text style={styles.footer}>
            {footer.text}{" "}
            <Link href={footer.href} replace style={styles.link}>
              {footer.label}
            </Link>
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** One labelled text field of an account form. */
export function AuthField({
  label,
  ...inputProps
}: { label: string } & TextInputProps) {
  return (
    <View style={styles.field}>
      <Text style={[form.label, styles.label]}>{label}</Text>
      <TextInput
        style={form.input}
        placeholderTextColor={colors.hint}
        {...inputProps}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: "center", paddingVertical: 24 },
  card: { padding: 29, gap: 0 },
  title: { marginTop: 4, marginBottom: 24 },
  field: { marginBottom: 16, gap: 4 },
  label: { marginTop: 0 },
  error: { marginBottom: 16, color: colors.danger, fontSize: 13 },
  actions: { flexDirection: "row" },
  submit: { flex: 0 },
  footer: { marginTop: 20, color: colors.muted, fontSize: 13 },
  link: { color: colors.accent, fontWeight: "600" },
});
