import { Text, View } from "react-native";

import { makeStyles, fonts } from "./theme";

/** The tilted orange "D" of the web Navbar, shown at the left of the tab headers. */
export function LogoMark() {
  const styles = useStyles();
  return (
    <View style={styles.mark} accessible={false}>
      <Text style={styles.letter}>D</Text>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  mark: {
    width: 29,
    height: 29,
    marginLeft: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.signal,
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
    borderBottomRightRadius: 5,
    borderBottomLeftRadius: 1,
    transform: [{ rotate: "-3deg" }],
  },
  letter: {
    fontFamily: fonts.utility,
    fontSize: 13,
    fontWeight: "700",
    color: colors.onSignal,
  },
}));
