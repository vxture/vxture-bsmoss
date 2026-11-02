// Port must come from the registered environment. PORT=0 is allowed for ephemeral local tests.
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
const require = createRequire(
  new URL("../portals/app/package.json", import.meta.url),
);
const port = process.env.PORT;
if (!port || !/^\d+$/.test(port) || Number(port) > 65535)
  throw Error(
    "Set PORT from the environment registry (or 0 for an ephemeral local test)",
  );
const mode = process.argv[2];
if (!["dev", "start"].includes(mode)) throw Error("invalid_mode");
const child = spawn(
  process.execPath,
  [
    require.resolve("next/dist/bin/next"),
    mode,
    "--hostname",
    process.env.HOSTNAME_BIND ?? "127.0.0.1",
    "--port",
    port,
  ],
  { stdio: "inherit", cwd: new URL("../portals/app/", import.meta.url) },
);
child.on("exit", (code) => process.exit(code ?? 1));
