import { readFileSync, readdirSync } from "node:fs";
import assert from "node:assert/strict";
import YAML from "yaml";
const read = p => readFileSync(p, "utf8");
const workflows = Object.fromEntries(readdirSync(".github/workflows").filter(p => p.endsWith(".yml")).map(p => [p, YAML.parse(read(".github/workflows/" + p))]));
const rules = JSON.parse(read("docs/50-deployment/rebuild/main-ruleset.json"));
assert.deepEqual(rules.bypass_actors, []);
const required = rules.rules.find(r => r.type === "required_status_checks").parameters.required_status_checks.map(c => c.context);
const ci = workflows["ci.yml"];
assert.ok(ci.on.pull_request && ci.on.push);
assert.ok(!ci.on.pull_request.paths && !ci.on.push.paths);
for (const context of required) {
  const jobs = Object.values(workflows).flatMap(w => Object.entries(w.jobs)).filter(([id, job]) => (job.name ?? id) === context);
  assert.equal(jobs.length, 1, context + " must be unique");
  assert.ok(!jobs[0][1].if && !jobs[0][1]["continue-on-error"], context + " cannot skip or soft-fail");
}
const compose = read("docker-compose.yml");
assert.ok(compose.includes("APP_PUBLISH_PORT:?"));
assert.ok(compose.includes('BSMOSS_PRODUCT_PREVIEW: "off"'));
assert.ok(!compose.includes("4060") && !compose.includes("4061"));
const dockerfile = read("portals/app/Dockerfile");
const workerCompose = YAML.parse(read("docker-compose.workers.yml"));
for (const name of ["aggregate-worker", "report-worker"]) {
  const worker = workerCompose.services[name];
  assert.equal(worker.image, '${IMAGE_REF:?set an immutable image digest}');
  assert.deepEqual(worker.command, ['node', '/app/worker/worker.cjs']);
  assert.equal(worker.environment.BSMOSS_PRODUCT_PREVIEW, 'off');
  assert.equal(worker.environment.BSMOSS_WORKER_KIND, name.replace('-worker', ''));
  assert.ok(worker.read_only && worker.init && !worker.ports && worker.cap_drop.includes('ALL'));
  assert.equal(worker.stop_grace_period, '120s');
  assert.ok(worker.healthcheck.test.includes('health'));
}
assert.ok(dockerfile.includes('RUN pnpm build:worker') && dockerfile.includes('/repo/artifacts/worker/worker.cjs'));
for (const name of ['deploy', 'rollback']) {
  assert.deepEqual(workflows[name + '.yml'].on.workflow_dispatch.inputs.workers.options, ['off', 'on']);
  assert.ok(read('.github/workflows/' + name + '.yml').includes("BSMOSS_DEPLOY_WORKERS='$WORKERS'"));
}
assert.ok(read('deploy/deploy.sh').includes('worker.cjs validate'));
assert.ok(read('deploy/deploy.sh').includes('stop -t 120 aggregate-worker report-worker'));
assert.ok(read('deploy/env-update.sh').includes('chmod 0644 "$tmp"'));
assert.ok(read('deploy/env-update.sh').includes('chmod 0700 "$STACK_ROOT/etc"'));
assert.ok(read('deploy/deploy.sh').includes('up -d --no-deps --force-recreate'));
const dockerIgnore=read(".dockerignore").split(/\r?\n/);
assert.ok(dockerIgnore.includes('tmp')&&dockerIgnore.includes('/*.pdf'), 'local logs and customer proposal must stay out of images');
assert.ok(dockerfile.includes("USER nextjs"));
assert.ok(dockerfile.includes("type=secret"));
assert.ok(!/ARG\s+\w*(?:TOKEN|SECRET|PASSWORD)/i.test(dockerfile));
assert.ok(!/db-init|prisma (?:migrate|db push)/.test(dockerfile));
for (const name of ["deploy", "rollback", "db-init", "env-update"]) {
  const w = workflows[name + ".yml"];
  assert.ok(w.on.workflow_dispatch && !w.on.push && !w.on.schedule);
  assert.equal(w.jobs.delivery.environment, "${{ inputs.stage }}");
  const text = read(".github/workflows/" + name + ".yml");
  assert.ok(text.includes("assert-stack-root.sh") && text.includes("StrictHostKeyChecking=yes"));
}
console.log("[delivery] six checks, empty bypass, explicit environments, secret mount and runtime isolation verified");
