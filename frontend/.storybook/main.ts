import type { StorybookConfig } from "@storybook/react-vite";
import type { PluginOption } from "vite";

/** Storybook already loads vite.config.ts (Tailwind, the `@/` alias); only the
 * TanStack Router plugins are dropped, so it never regenerates routeTree.gen.ts. */
function isRouterPlugin(plugin: PluginOption): boolean {
  return (
    typeof plugin === "object" &&
    plugin !== null &&
    "name" in plugin &&
    plugin.name.startsWith("tanstack")
  );
}

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-docs", "@storybook/addon-a11y"],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  viteFinal: async (config) => {
    config.plugins = (config.plugins ?? [])
      .flat(3)
      .filter((plugin) => !isRouterPlugin(plugin));
    return config;
  },
};

export default config;
