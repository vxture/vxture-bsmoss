"use client";

import { ShellPreferencePanel, useTheme } from "@vxture/design-system";

export default function ProductPreferences() {
  const { mode, setMode, density, setDensity, fontSize, setFontSize } = useTheme();
  return <ShellPreferencePanel locale="zh-CN" localeOptions={[{ locale: "zh-CN", nativeName: "\u7b80\u4f53\u4e2d\u6587" }]}
    theme={mode} density={density} fontSize={fontSize}
    onLocaleChange={() => {}} onThemeChange={setMode} onDensityChange={setDensity} onFontSizeChange={setFontSize}
    labels={{ title: "\u5916\u89c2\u504f\u597d", locale: "\u8bed\u8a00", theme: "\u4e3b\u9898", density: "\u5bc6\u5ea6", fontSize: "\u5b57\u53f7",
      themeOptions: { light: "\u6d45\u8272", dark: "\u6df1\u8272", system: "\u7cfb\u7edf" },
      densityOptions: { compact: "\u7d27\u51d1", default: "\u6807\u51c6", comfortable: "\u5bbd\u677e" },
      fontSizeOptions: { small: "\u5c0f", default: "\u6807\u51c6", large: "\u5927" } }} />;
}
