import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { test } from 'node:test'

import { brokenLinks } from '../scripts/links.mjs'

const ROOT = new URL('..', import.meta.url).pathname

test("every link of chromokit's site leads somewhere (the example sites and the R site, which CI builds, aside)", () => {
  execFileSync(process.execPath, [join(ROOT, 'scripts', 'site.mjs')], { stdio: 'pipe' })
  assert.deepEqual(brokenLinks(join(ROOT, 'site', '_build'), { skipMissing: true }), [])
})
