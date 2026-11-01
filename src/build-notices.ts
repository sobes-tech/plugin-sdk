import { readFile, readdir } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";

interface PackageInfo {
  root: string;
  name: string;
  version: string;
  license: unknown;
  repository: unknown;
}

const NOTICE_FILE = /^(?:licen[sc]e|copying|notice|copyright(?:notice)?|ofl)(?:[._-].*)?$/i;

/** Uses the compiler's contributing inputs, never patterns found in generated JavaScript. */
export async function collectBuildNotices(
  metafile: Bun.BuildMetafile,
  entrypoint: string,
  baseDir = process.cwd(),
): Promise<{ comment: string; missing: string[] }> {
  const directories = new Map<string, Promise<PackageInfo | null>>();

  const findPackage = (directory: string): Promise<PackageInfo | null> => {
    const previous = directories.get(directory);

    if (previous) {
      return previous;
    }

    const found = (async () => {
      let value: Record<string, unknown> | undefined;

      try {
        value = JSON.parse(await readFile(join(directory, "package.json"), "utf8"));
      } catch (error) {
        if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) {
          throw error;
        }
      }

      if (typeof value?.name === "string") {
        return {
          root: directory,
          name: value.name,
          version: typeof value.version === "string" ? value.version : "unversioned",
          license: value.license,
          repository: value.repository,
        };
      }

      const parent = dirname(directory);

      return parent === directory ? null : findPackage(parent);
    })();

    directories.set(directory, found);

    return found;
  };

  const ownPackage = await findPackage(dirname(resolve(baseDir, entrypoint)));
  const paths = new Set(
    Object.values(metafile.outputs).flatMap((output) =>
      Object.entries(output.inputs)
        .filter(([, input]) => input.bytesInOutput > 0)
        .map(([path]) => path),
    ),
  );
  const packages = new Map<string, PackageInfo>();

  for (const path of paths) {
    // Bun's runtime inputs have no filesystem owner.
    if (path.startsWith("<") || path.startsWith("bun:")) {
      continue;
    }

    const dependency = await findPackage(dirname(resolve(baseDir, path)));

    if (dependency && dependency.root !== ownPackage?.root) {
      packages.set(dependency.root, dependency);
    }
  }

  const missing: string[] = [];
  const sections: string[] = [];
  const sorted = [...packages.values()].sort((a, b) =>
    `${a.name}@${a.version}`.localeCompare(`${b.name}@${b.version}`, "en"),
  );

  for (const dependency of sorted) {
    const name = `${dependency.name}@${dependency.version}`;
    const files = (await readdir(dependency.root, { withFileTypes: true }))
      .filter((file) => file.isFile() && NOTICE_FILE.test(file.name))
      .map((file) => join(dependency.root, file.name))
      .sort();
    const sectionsForPackage = [`=== ${name} ===`];

    if (dependency.license !== undefined) {
      sectionsForPackage.push(`Declared license: ${JSON.stringify(dependency.license)}`);
    }

    if (dependency.repository !== undefined) {
      sectionsForPackage.push(`Repository: ${JSON.stringify(dependency.repository)}`);
    }

    for (const file of files) {
      sectionsForPackage.push(
        `--- ${relative(dependency.root, file)} ---\n${await readFile(file, "utf8")}`,
      );
    }

    if (!files.length) {
      missing.push(name);
      sectionsForPackage.push(
        "No license/notice file in the installed package. Review upstream rights before distribution.",
      );
    }

    sections.push(sectionsForPackage.join("\n"));
  }

  if (!sections.length) {
    return { comment: "", missing };
  }

  // Package metadata and notice files are untrusted text, never executable source.
  const text = sections.join("\n\n").replace(/\*\//g, "*\\/").replace(/<\//g, "<\\/");

  return {
    comment: `/*!\nThird-party licenses and notices for bundled dependencies\n\n${text}\n*/\n`,
    missing,
  };
}
