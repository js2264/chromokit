#!/usr/bin/env node
/**
 * Does every relative link of chromokit's site lead somewhere?
 *
 *     node scripts/links.mjs [site-dir]      (default: site/_build)
 *
 * Reads the site's own pages (not the example sites under examples/<target>/
 * or the R package's site under r/, which their own tools build) and checks
 * each relative `href` and `src` against the files on disk. Exits 1 and names
 * every link that leads nowhere. .github/workflows/site.yml runs it once the
 * examples are in place; test/site.test.mjs runs it without them, skipping the
 * links into the parts only CI builds.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** The site's own pages: every .html outside examples/<target>/, r/ and dist/. */
function pages(root) {
  const out = []
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name)
      const rel = relative(root, path).split('\\').join('/')
      if (statSync(path).isDirectory()) {
        if (/^(examples\/[^/]+|r|dist|screens)$/.test(rel)) continue
        walk(path)
      } else if (name.endsWith('.html')) out.push(path)
    }
  }
  walk(root)
  return out
}

/**
 * Every relative link of the site's pages that leads to no file, as
 * `page → link`. With `skipMissing`, a link into a part of the site that is not
 * built here (examples/<target>/, r/) is not counted when that part is absent.
 */
export function brokenLinks(root, { skipMissing = false } = {}) {
  const broken = []
  for (const page of pages(root)) {
    const html = readFileSync(page, 'utf8')
    for (const m of html.matchAll(/\s(?:href|src)="([^"#?]+)[^"]*"/g)) {
      const link = m[1]
      if (/^(?:[a-z]+:|\/\/|data:)/i.test(link)) continue
      const target = resolve(dirname(page), link)
      const rel = relative(root, target).split('\\').join('/')
      if (rel.startsWith('..')) {
        broken.push(`${relative(root, page)} → ${link} (outside the site)`)
        continue
      }
      const file = link.endsWith('/') ? join(target, 'index.html') : target
      if (existsSync(file)) continue
      const part = /^(examples\/[^/]+|r)(\/|$)/.exec(rel)?.[1]
      if (skipMissing && part !== undefined && !existsSync(join(root, part))) continue
      broken.push(`${relative(root, page)} → ${link}`)
    }
  }
  return broken
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = resolve(process.argv[2] ?? 'site/_build')
  const broken = brokenLinks(root)
  if (broken.length === 0) {
    console.log(`every link of ${relative(process.cwd(), root) || '.'} leads somewhere`)
  } else {
    for (const line of broken) console.error(`broken: ${line}`)
    process.exit(1)
  }
}
