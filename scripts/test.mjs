import { readdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
function tests(dir) {
  return readdirSync(dir,{withFileTypes:true}).flatMap(entry => {
    const file=join(dir,entry.name);
    return entry.isDirectory() ? tests(file) : /\.test\.ts$/.test(file) && !/\.db\.test\.ts$/.test(file) ? [file] : [];
  });
}
const coverage=process.argv.includes("--coverage") ? ["--experimental-test-coverage"] : [];
const result=spawnSync(process.execPath,["--import","tsx","--test",...coverage,...tests("portals/app/app")],{stdio:"inherit"});
if(result.error) throw result.error;
process.exitCode=result.status ?? 1;
