import { Link } from "expo-router";
import type { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";

import { Button } from "../../ui/Button";
import { common, form } from "../../ui/classes";

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
      className={common.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerClassName="grow justify-center py-6"
        keyboardShouldPersistTaps="handled"
      >
        <View className="mx-4 mt-4 rounded-lg border border-card-line bg-paper p-[29px] shadow-[0_8px_18px_rgba(29,55,57,0.06)]">
          <Text className={common.eyebrow}>KONTO</Text>
          <Text className="mt-1 mb-6 font-display text-[28px] font-bold tracking-[-0.5px] text-ink">
            {title}
          </Text>
          {children}
          {error !== "" && (
            <Text className="mb-4 text-[13px] text-danger">{error}</Text>
          )}
          <View className="flex-row">
            <Button
              label={submitLabel}
              disabled={!canSubmit}
              isBusy={isSubmitting}
              onPress={onSubmit}
              className="flex-none"
            />
          </View>
          <Text className="mt-5 text-[13px] text-muted">
            {footer.text}{" "}
            <Link href={footer.href} replace asChild>
              <Text className="font-semibold text-accent">{footer.label}</Text>
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
    <View className="mb-4 gap-1">
      <Text className="text-xs font-semibold text-ink-soft">{label}</Text>
      <TextInput
        className={form.input}
        placeholderTextColorClassName="accent-hint"
        {...inputProps}
      />
    </View>
  );
}
