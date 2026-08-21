const assert = require("node:assert/strict");
const { execFile: execFileCallback } = require("node:child_process");
const { mkdtemp, readFile, writeFile } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { promisify } = require("node:util");
const test = require("node:test");

const { updateGodotProjectVersion } = require("../dist/index.js");
const execFile = promisify(execFileCallback);

async function createProject(content) {
  const directory = await mkdtemp(join(tmpdir(), "godot-semver-updater-"));
  const projectPath = join(directory, "project.godot");
  await writeFile(projectPath, content, "utf8");
  return projectPath;
}

test("updates an existing application version without changing other settings", async () => {
  const projectPath = await createProject(
    "config_version=5\n\n[application]\n\nconfig/name=\"DogfooderTwo\"\nconfig/version=\"0.0.0\"\n\n[rendering]\nrenderer/rendering_method=\"gl_compatibility\"\n",
  );

  const result = await updateGodotProjectVersion({ projectPath, version: "1.2.3" });

  assert.deepEqual(result, {
    projectPath,
    previousVersion: "0.0.0",
    version: "1.2.3",
    changed: true,
  });
  assert.equal(
    await readFile(projectPath, "utf8"),
    "config_version=5\n\n[application]\n\nconfig/name=\"DogfooderTwo\"\nconfig/version=\"1.2.3\"\n\n[rendering]\nrenderer/rendering_method=\"gl_compatibility\"\n",
  );
});

test("adds the version when the application section has none", async () => {
  const projectPath = await createProject("[application]\n\nconfig/name=\"DogfooderTwo\"\n");

  const result = await updateGodotProjectVersion({ projectPath, version: "1.2.3-beta.1" });

  assert.deepEqual(result, { projectPath, version: "1.2.3-beta.1", changed: true });
  assert.equal(
    await readFile(projectPath, "utf8"),
    "[application]\nconfig/version=\"1.2.3-beta.1\"\n\nconfig/name=\"DogfooderTwo\"\n",
  );
});

test("adds an application section when it is missing", async () => {
  const projectPath = await createProject("config_version=5\n");

  const result = await updateGodotProjectVersion({ projectPath, version: "1.2.3" });

  assert.deepEqual(result, { projectPath, version: "1.2.3", changed: true });
  assert.equal(
    await readFile(projectPath, "utf8"),
    "config_version=5\n[application]\n\nconfig/version=\"1.2.3\"\n",
  );
});

test("can validate without writing the project file", async () => {
  const original = "[application]\r\n\r\nconfig/version=\"1.0.0\"\r\n";
  const projectPath = await createProject(original);

  const result = await updateGodotProjectVersion({ projectPath, version: "1.2.3", dryRun: true });

  assert.equal(result.changed, true);
  assert.equal(result.previousVersion, "1.0.0");
  assert.equal(await readFile(projectPath, "utf8"), original);
});

test("rejects an invalid semantic version by default", async () => {
  const projectPath = await createProject("[application]\n");

  await assert.rejects(
    updateGodotProjectVersion({ projectPath, version: "v1.2.3" }),
    /valid semantic version/,
  );
});

test("allows a non-semantic version when requested", async () => {
  const projectPath = await createProject("[application]\n");

  await updateGodotProjectVersion({
    projectPath,
    version: "2026.08-nightly",
    validateSemver: false,
  });

  assert.match(await readFile(projectPath, "utf8"), /config\/version="2026\.08-nightly"/);
});

test("the command-line interface updates the selected project", async () => {
  const projectPath = await createProject("[application]\n\nconfig/version=\"1.0.0\"\n");

  await execFile(process.execPath, [
    "dist/cli.js",
    "--project",
    projectPath,
    "--version",
    "2.0.0",
  ]);

  assert.match(await readFile(projectPath, "utf8"), /config\/version="2\.0\.0"/);
});

test("the command-line interface can normalize a v-prefixed tag", async () => {
  const projectPath = await createProject("[application]\n");

  await execFile(process.execPath, [
    "dist/cli.js",
    "--project",
    projectPath,
    "--version",
    "v2.0.0",
    "--strip-leading-v",
  ]);

  assert.match(await readFile(projectPath, "utf8"), /config\/version="2\.0\.0"/);
});
