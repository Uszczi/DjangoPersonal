import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { Platform, Pressable, Text, View } from "react-native";

import { formatEntryTime } from "@personal/shared/counterFormat";

import { useTheme } from "../theme";

const dayFormatter = new Intl.DateTimeFormat("pl-PL", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

type DateTimeFieldProps = {
  value: Date;
  onChange: (value: Date) => void;
  /** `date` picks only the day (the result is local midnight). */
  mode?: "datetime" | "date";
  disabled?: boolean;
};

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * A date, or a date and time, in one field. iOS has a compact inline picker;
 * Android only has dialogs, so for date and time it asks for the date, then
 * the time.
 */
export function DateTimeField({
  value,
  onChange,
  mode = "datetime",
  disabled = false,
}: DateTimeFieldProps) {
  const { colors, form } = useTheme();
  const emit = (date: Date) =>
    onChange(mode === "date" ? startOfDay(date) : date);

  if (Platform.OS === "ios") {
    return (
      <View style={{ alignItems: "flex-start" }}>
        <DateTimePicker
          value={value}
          mode={mode}
          display="compact"
          locale="pl-PL"
          disabled={disabled}
          onChange={(_event: DateTimePickerEvent, date?: Date) =>
            date && emit(date)
          }
        />
      </View>
    );
  }

  function pickOnAndroid() {
    DateTimePickerAndroid.open({
      value,
      mode: "date",
      onChange: (event, date) => {
        if (event.type !== "set" || !date) return;
        if (mode === "date") {
          emit(date);
          return;
        }
        DateTimePickerAndroid.open({
          value: date,
          mode: "time",
          is24Hour: true,
          onChange: (timeEvent, dateTime) => {
            if (timeEvent.type === "set" && dateTime) emit(dateTime);
          },
        });
      },
    });
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={
        mode === "date" ? "Zmienia datę" : "Zmienia datę i godzinę"
      }
      disabled={disabled}
      onPress={pickOnAndroid}
      style={form.input}
    >
      <Text style={{ fontSize: 14, color: colors.ink }}>
        {mode === "date" ? dayFormatter.format(value) : formatEntryTime(value)}
      </Text>
    </Pressable>
  );
}
