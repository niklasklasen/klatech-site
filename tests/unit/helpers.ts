import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));

export const abs = (...parts: string[]) => join(ROOT, ...parts);
export const rel = (path: string) => relative(ROOT, path);
export const read = (path: string) => readFileSync(path, 'utf8');
export const exists = (path: string) => existsSync(path);

/** Every file under `dir` matching `filter`, recursively. Missing dir -> []. */
export function walk(dir: string, filter: (p: string) => boolean = () => true): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full, filter));
    else if (filter(full)) out.push(full);
  }
  return out.sort();
}

/** Report a failure with a file:line pointer, the way a defect ticket needs it. */
export function locate(path: string, needle: string | RegExp): string {
  const lines = read(path).split('\n');
  const idx = lines.findIndex((line) =>
    typeof needle === 'string' ? line.includes(needle) : needle.test(line),
  );
  return idx === -1 ? rel(path) : `${rel(path)}:${idx + 1}`;
}

/** Split `---`-delimited YAML frontmatter from a markdown body. */
export function splitFrontmatter(source: string): { frontmatter: string; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(source);
  if (!match) throw new Error('no frontmatter block');
  return { frontmatter: match[1], body: match[2] };
}
