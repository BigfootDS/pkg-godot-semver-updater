#!/usr/bin/env node

import { parseArgs } from "node:util";
import { updateGodotProjectVersion } from "./index.js";

const help = `Usage: godot-semver-updater --version <version> [options]

Update the application version in a Godot project.godot file.

Options:
  -p, --project <path>     Project file to update (default: project.godot)
  -v, --version <version>  Semantic version to write (required)
      --strip-leading-v    Remove one leading v from the version
      --allow-non-semver   Do not validate the version as semantic versioning
      --dry-run            Report the change without writing the file
  -h, --help               Show this help message
`;

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      project: { type: "string", short: "p", default: "project.godot" },
      version: { type: "string", short: "v" },
      "strip-leading-v": { type: "boolean", default: false },
      "allow-non-semver": { type: "boolean", default: false },
      "dry-run": { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
    strict: true,
  });

  if (values.help) {
    process.stdout.write(help);
    return;
  }

  if (values.version === undefined) {
    throw new Error("--version is required. Run with --help for usage.");
  }

  const version =
    values["strip-leading-v"] && values.version.startsWith("v")
      ? values.version.slice(1)
      : values.version;
  const result = await updateGodotProjectVersion({
    projectPath: values.project ?? "project.godot",
    version,
    validateSemver: !values["allow-non-semver"],
    dryRun: values["dry-run"],
  });

  const verb = values["dry-run"] ? "Would update" : "Updated";
  const previous = result.previousVersion === undefined ? "(unset)" : result.previousVersion;
  process.stdout.write(
    `${verb} ${result.projectPath}: ${previous} -> ${result.version}${result.changed ? "" : " (unchanged)"}\n`,
  );
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`godot-semver-updater: ${message}\n`);
  process.exitCode = 1;
});
