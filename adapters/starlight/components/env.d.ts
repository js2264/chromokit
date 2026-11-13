declare module 'virtual:chromokit/config' {
  const config: {
    title: string
    kicker: string | false
    version: string | null
    cta: { text?: string; href: string } | null
    repository: string | null
    footer: string
  }
  export default config
}
