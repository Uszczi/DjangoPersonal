const { getDefaultConfig } = require("expo/metro-config");
const { withUniwindConfig } = require("uniwind/metro");

const { extraThemes, writeGlobalCss } = require("./themeCss");

// global.css is generated from the shared palettes before Metro reads it.
writeGlobalCss();

// withUniwindConfig must stay the outermost wrapper.
module.exports = withUniwindConfig(getDefaultConfig(__dirname), {
  cssEntryFile: "./global.css",
  dtsFile: "./src/uniwind-types.d.ts",
  extraThemes,
});
