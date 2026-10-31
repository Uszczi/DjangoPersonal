import { Text, View } from "react-native";

/** The tilted orange "D" of the web Navbar, shown at the left of the tab headers. */
export function LogoMark() {
  return (
    <View
      className="ml-4 size-[29px] -rotate-3 items-center justify-center rounded-t-[5px] rounded-br-[5px] rounded-bl-[1px] bg-signal"
      accessible={false}
    >
      <Text className="font-utility text-[13px] font-bold text-on-signal">
        D
      </Text>
    </View>
  );
}
