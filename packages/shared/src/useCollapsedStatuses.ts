import { useMemo, useState } from "react";

/**
 * Which status sections of a Project's task list are collapsed. The terminal
 * status starts collapsed (finished Tasks pile up and are rarely looked at),
 * every other status starts open. Only the user's toggles are stored, so a
 * Project picked later still opens with its own terminal status collapsed.
 */
export function useCollapsedStatuses(terminalStatus: string | undefined) {
  const [toggled, setToggled] = useState<ReadonlySet<string>>(new Set());

  const collapsed = useMemo(() => {
    const next = new Set(toggled);
    if (terminalStatus !== undefined) {
      if (next.has(terminalStatus)) next.delete(terminalStatus);
      else next.add(terminalStatus);
    }
    return next as ReadonlySet<string>;
  }, [toggled, terminalStatus]);

  function flip(current: ReadonlySet<string>, status: string) {
    const next = new Set(current);
    if (next.has(status)) next.delete(status);
    else next.add(status);
    return next;
  }

  function toggle(status: string) {
    setToggled((current) => flip(current, status));
  }

  function expand(status: string) {
    setToggled((current) => {
      const isCollapsed = current.has(status) !== (status === terminalStatus);
      return isCollapsed ? flip(current, status) : current;
    });
  }

  return { collapsed, toggle, expand };
}
