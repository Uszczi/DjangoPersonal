import { LogoMark } from "./LogoMark";
import { ScreenHeader } from "./ScreenHeader";

/**
 * The props a navigation header receives, as far as these adapters care: the
 * screen's title and its route name. Both the native stack and the bottom
 * tabs pass a superset of this, so the same adapters fit either navigator.
 */
type HeaderProps = {
  options: { title?: string };
  route: { name: string };
};

function title({ options, route }: HeaderProps): string {
  return typeof options.title === "string" && options.title !== ""
    ? options.title
    : route.name;
}

/**
 * The root Stack's header: the custom ScreenHeader. Its back arrow appears
 * whenever there is somewhere to go back to (ScreenHeader checks the router).
 */
export function StackHeader(props: HeaderProps) {
  return <ScreenHeader title={title(props)} />;
}

/**
 * The tabs' header: the same custom ScreenHeader, with the logo instead of a
 * back arrow.
 */
export function TabHeader(props: HeaderProps) {
  return <ScreenHeader title={title(props)} left={<LogoMark />} />;
}
