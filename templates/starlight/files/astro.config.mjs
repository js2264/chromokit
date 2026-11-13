// @ts-check
import starlight from '@astrojs/starlight'
import { defineConfig } from 'astro/config'
import starlightThemeRapide from 'starlight-theme-rapide'

import chromokit from './src/chromokit/index.mjs'

export default defineConfig({
  site: '{{origin}}',
  base: '{{base}}',
  trailingSlash: 'always',
  integrations: [
    starlight({
      title: '{{name}}',
      description: '{{description}}',
      logo: { src: './src/assets/mark.svg', alt: '' },
      favicon: '/favicon.svg',
      social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/{{repo}}' }],
      // Your own styles: chromokit's stylesheet is put before these.
      customCss: ['./src/styles/site.css'],
      sidebar: [
        {
          label: 'Getting started',
          items: [
            { label: 'Installation', slug: 'guides/installation' },
            { label: 'Quickstart', slug: 'guides/quickstart' },
          ],
        },
      ],
      plugins: [
        starlightThemeRapide(),
        chromokit({
          kicker: 'docs',
          version: '0.1.0',
          // cta: { text: 'Open the app', href: 'https://example.org' },
        }),
      ],
    }),
  ],
})
