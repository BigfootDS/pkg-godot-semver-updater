# Godot SemVer Updater

Update a Godot project's `[application] config/version` value from Node.js or the command line.

## Requirements

Node.js 20 or later.

## Command line

Run the package without installing it globally:

```sh
npx @bigfootds/godot-semver-updater --version 1.2.3
```

By default it updates `project.godot` in the current directory. Use `--project` to specify a different file:

```sh
npx @bigfootds/godot-semver-updater \
  --project path/to/project.godot \
  --version 1.2.3-beta.1
```

Versions are validated as [semantic versions](https://semver.org/) by default. Pass `--allow-non-semver` for a custom Godot version string, or `--dry-run` to inspect an update without changing the file.

This fits directly in a GitHub Actions workflow after Node is available:

```yaml
- uses: actions/setup-node@v5
  with:
    node-version: 20

- run: npx @bigfootds/godot-semver-updater --version "${{ github.ref_name }}" --strip-leading-v
```

Use `--strip-leading-v` when Git tags follow the common `v1.2.3` convention. Use `--allow-non-semver` for a custom version format.

## Library

```ts
import { updateGodotProjectVersion } from "@bigfootds/godot-semver-updater";

const result = await updateGodotProjectVersion({
  projectPath: "project.godot",
  version: "1.2.3",
});

console.log(result.previousVersion, result.version);
```

The updater preserves unrelated settings and line endings, adds the version when the `[application]` section exists but has no `config/version`, and can run without writing with `dryRun: true`.

## Development

```sh
npm ci
npm test
npm run pack:check
```

## Releases

CD releases every conventional commit that reaches `main`; do not manually edit `package.json`'s version or create release tags. The highest-impact commit since the previous release determines the version:

- `feat:` creates a minor release.
- `type!:` or a `BREAKING CHANGE:` footer creates a major release.
- Any other conventional commit type creates a patch release.

The workflow rejects a non-conventional commit that reaches `main`, commits the generated version, creates its `vX.Y.Z` tag and GitHub release, then publishes the package with npm Trusted Publishing. All feature work should use conventional commits and be merged into `main` through a pull request. If squash-merging, ensure the resulting squash commit (usually the pull request title) is conventional too.
