import { readFile, writeFile } from "node:fs/promises";
import { isSemanticVersion } from "./semver.js";

export interface UpdateGodotProjectVersionOptions {
  /** Path to the Godot project configuration file. */
  projectPath: string;
  /** The version written to `[application] config/version`. */
  version: string;
  /**
   * Validate the supplied version using semantic versioning rules.
   *
   * @defaultValue true
   */
  validateSemver?: boolean;
  /** Calculate the update without writing the project file. */
  dryRun?: boolean;
}

export interface UpdateGodotProjectVersionResult {
  projectPath: string;
  previousVersion?: string;
  version: string;
  changed: boolean;
}

interface RenderedProjectVersion {
  content: string;
  previousVersion?: string;
  changed: boolean;
}

/**
 * Updates `[application] config/version` in a Godot `project.godot` file.
 * Existing line endings and unrelated settings are preserved.
 */
export async function updateGodotProjectVersion(
  options: UpdateGodotProjectVersionOptions,
): Promise<UpdateGodotProjectVersionResult> {
  validateOptions(options);

  const original = await readFile(options.projectPath, "utf8");
  const rendered = renderProjectVersion(original, options.version);

  if (rendered.changed && !options.dryRun) {
    await writeFile(options.projectPath, rendered.content, "utf8");
  }

  return {
    projectPath: options.projectPath,
    ...(rendered.previousVersion === undefined
      ? {}
      : { previousVersion: rendered.previousVersion }),
    version: options.version,
    changed: rendered.changed,
  };
}

function validateOptions(options: UpdateGodotProjectVersionOptions): void {
  if (options.projectPath.trim().length === 0) {
    throw new Error("projectPath must not be empty.");
  }

  if (options.version.trim().length === 0) {
    throw new Error("version must not be empty.");
  }

  if (options.validateSemver !== false && !isSemanticVersion(options.version)) {
    throw new Error(
      `version must be a valid semantic version; received ${JSON.stringify(options.version)}.`,
    );
  }
}

function renderProjectVersion(content: string, version: string): RenderedProjectVersion {
  const newline = content.includes("\r\n") ? "\r\n" : "\n";
  const applicationSection = findSection(content, "application");
  const versionLine = `config/version=${JSON.stringify(version)}`;

  if (applicationSection === undefined) {
    const separator = content.length === 0 || content.endsWith("\n") ? "" : newline;
    return {
      content: `${content}${separator}[application]${newline}${newline}${versionLine}${newline}`,
      changed: true,
    };
  }

  const sectionContent = content.slice(applicationSection.bodyStart, applicationSection.end);
  const existingVersion = /^([\t ]*config\/version[\t ]*=[\t ]*)(.*?)(\r?)(?=\n|$)/m.exec(
    sectionContent,
  );

  if (existingVersion !== null) {
    const [, prefix = "", currentValue = "", lineEnding = ""] = existingVersion;
    const previousVersion = parseGodotString(currentValue.trim());
    const replacement = `${prefix}${versionLine.slice("config/version=".length)}${lineEnding}`;
    const updatedSection = sectionContent.replace(existingVersion[0], replacement);
    const updatedContent = `${content.slice(0, applicationSection.bodyStart)}${updatedSection}${content.slice(
      applicationSection.end,
    )}`;

    return {
      content: updatedContent,
      ...(previousVersion === undefined ? {} : { previousVersion }),
      changed: updatedContent !== content,
    };
  }

  return {
    content: `${content.slice(0, applicationSection.bodyStart)}${newline}${versionLine}${sectionContent}${content.slice(
      applicationSection.end,
    )}`,
    changed: true,
  };
}

function findSection(
  content: string,
  name: string,
): { bodyStart: number; end: number } | undefined {
  const sectionPattern = /^[\t ]*\[([^\]]+)\][\t ]*(?:;.*)?\r?$/gm;
  let match: RegExpExecArray | null;
  let applicationSection: RegExpExecArray | undefined;

  while ((match = sectionPattern.exec(content)) !== null) {
    if (applicationSection !== undefined) {
      return {
        bodyStart: applicationSection.index + applicationSection[0].length,
        end: match.index,
      };
    }

    if (match[1] === name) {
      applicationSection = match;
    }
  }

  return applicationSection === undefined
    ? undefined
    : {
        bodyStart: applicationSection.index + applicationSection[0].length,
        end: content.length,
      };
}

function parseGodotString(value: string): string | undefined {
  if (!value.startsWith('"') || !value.endsWith('"')) {
    return value.length === 0 ? undefined : value;
  }

  try {
    return JSON.parse(value) as string;
  } catch {
    return value;
  }
}
