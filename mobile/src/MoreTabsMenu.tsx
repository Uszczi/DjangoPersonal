import { router } from "expo-router";

import { Sheet, SheetItem } from "./Sheet";
import { pinnedTab, tabDefinitions, type TabName } from "./tabBar";

/**
 * The popup behind the Więcej tab, which stands in for Konto while some tabs
 * are hidden: it lists the hidden tabs, in the bar's order, then Konto.
 */
export function MoreTabsMenu({
  hidden,
  onClose,
}: {
  hidden: TabName[];
  onClose: () => void;
}) {
  const names = [...hidden, pinnedTab];

  function open(name: TabName) {
    onClose();
    router.navigate(tabDefinitions[name].href);
  }

  return (
    <Sheet title="Więcej" onClose={onClose}>
      {names.map((name) => {
        const tab = tabDefinitions[name];
        return (
          <SheetItem
            key={name}
            icon={tab.icon}
            label={tab.title}
            onPress={() => open(name)}
          />
        );
      })}
    </Sheet>
  );
}
