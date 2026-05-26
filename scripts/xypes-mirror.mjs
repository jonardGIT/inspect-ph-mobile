import { fileURLToPath } from "node:url";
import fs from "node:fs/promises";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const workspaceRoot = path.resolve(repoRoot, "..");
const defaultMirrorRoot = path.resolve(
  repoRoot,
  "..",
  "..",
  "inspect-ph-mirror",
);
const mirrorRoot = process.env.XYPES_MIRROR_ROOT?.trim()
  ? path.resolve(process.env.XYPES_MIRROR_ROOT)
  : defaultMirrorRoot;
const outputDir = path.join(mirrorRoot, "xypes-inspectph-mobile");
const sharedTypesSourceCandidates = [
  path.join(workspaceRoot, "shared", "types", "api.ts"),
  path.join(repoRoot, "shared", "types", "api.ts"),
];

const copyEntries = [
  ".env.local.example",
  ".gitignore",
  "app",
  "app.json",
  "components",
  "constants",
  "eas.json",
  "eslint.config.js",
  "expo-env.d.ts",
  "hooks",
  "jest.config.ts",
  "lib",
  "package-lock.json",
  "package.json",
  "tsconfig.json",
];

async function ensureCleanDir(directory) {
  await fs.rm(directory, { force: true, recursive: true });
  await fs.mkdir(directory, { recursive: true });
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function copyEntry(source, destination) {
  const stats = await fs.stat(source);

  if (stats.isDirectory()) {
    await fs.mkdir(destination, { recursive: true });
    const entries = await fs.readdir(source, { withFileTypes: true });

    for (const entry of entries) {
      await copyEntry(
        path.join(source, entry.name),
        path.join(destination, entry.name),
      );
    }

    return;
  }

  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.copyFile(source, destination);
}

async function resolveSharedTypesSource() {
  for (const candidate of sharedTypesSourceCandidates) {
    if (await pathExists(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    `Shared API contract not found. Checked: ${sharedTypesSourceCandidates.join(
      ", ",
    )}`,
  );
}

async function walk(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await walk(entryPath)));
      continue;
    }

    files.push(entryPath);
  }

  return files;
}

function buildMirrorPackageJson(sourcePackageJson) {
  const scripts = { ...sourcePackageJson.scripts };
  delete scripts["mirror:xypes:prepare"];

  return {
    ...sourcePackageJson,
    scripts,
  };
}

function rewriteSharedImports(source) {
  return source
    .replaceAll("../../../shared/", "__XYPES_SHARED_UP_3__")
    .replaceAll("../../shared/", "__XYPES_SHARED_UP_2__")
    .replaceAll("<rootDir>/../shared/", "<rootDir>/shared/")
    .replaceAll("__XYPES_SHARED_UP_3__", "../../shared/")
    .replaceAll("__XYPES_SHARED_UP_2__", "../shared/");
}

async function rewriteMirrorFiles(directory) {
  const files = await walk(directory);

  for (const filePath of files) {
    if (!/\.(?:[cm]?[jt]sx?|json)$/.test(filePath)) {
      continue;
    }

    const source = await fs.readFile(filePath, "utf8");
    const updated = rewriteSharedImports(source);

    if (updated !== source) {
      await fs.writeFile(filePath, updated);
    }
  }
}

async function prepareMirror() {
  await ensureCleanDir(outputDir);
  const sharedTypesSource = await resolveSharedTypesSource();

  for (const entry of copyEntries) {
    const sourcePath = path.join(repoRoot, entry);

    if (await pathExists(sourcePath)) {
      await copyEntry(sourcePath, path.join(outputDir, entry));
    }
  }

  await copyEntry(
    sharedTypesSource,
    path.join(outputDir, "shared", "types", "api.ts"),
  );

  const packageJsonPath = path.join(outputDir, "package.json");
  const packageJson = JSON.parse(await fs.readFile(packageJsonPath, "utf8"));
  await fs.writeFile(
    packageJsonPath,
    `${JSON.stringify(buildMirrorPackageJson(packageJson), null, 2)}\n`,
  );

  await rewriteMirrorFiles(outputDir);
}

const mode = process.argv[2] ?? "prepare";

if (mode === "prepare") {
  await prepareMirror();
} else {
  throw new Error(`Unsupported mode: ${mode}`);
}
