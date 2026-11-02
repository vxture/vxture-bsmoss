// Windows local builds avoid standalone symlinks; Linux release builds retain standalone output.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const here = dirname(fileURLToPath(import.meta.url));
export default {
  output: process.platform === "win32" ? undefined : "standalone",
  outputFileTracingRoot: join(here, "../.."),
  transpilePackages: ["@bsmoss/shared"],
  reactStrictMode: true,
  poweredByHeader: false,
};
