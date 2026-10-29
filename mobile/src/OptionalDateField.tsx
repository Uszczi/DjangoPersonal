import { View } from "react-native";

import { dateFromKey, todayKey } from "@personal/shared/timeFormat";

import { Button } from "./Button";
import { DateTimeField } from "./DateTimeField";

type OptionalDateFieldProps = {
  value: Date | null;
  onChange: (value: Date | null) => void;
  disabled?: boolean;
};

/**
 * A calendar day that may be left unknown. The native pickers always hold a
 * date, so an empty field is a button that sets today, and a set one can be
 * cleared again.
 */
export function OptionalDateField({
  value,
  onChange,
  disabled = false,
}: OptionalDateFieldProps) {
  if (value === null) {
    return (
      <View style={{ flexDirection: "row" }}>
        <Button
          label="Ustaw datę"
          variant="secondary"
          disabled={disabled}
          onPress={() => onChange(dateFromKey(todayKey()))}
        />
      </View>
    );
  }
  return (
    <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
      <View style={{ flex: 1 }}>
        <DateTimeField
          mode="date"
          value={value}
          onChange={onChange}
          disabled={disabled}
        />
      </View>
      <Button
        label="Bez daty"
        variant="secondary"
        disabled={disabled}
        onPress={() => onChange(null)}
        style={{ flex: 0 }}
      />
    </View>
  );
}
