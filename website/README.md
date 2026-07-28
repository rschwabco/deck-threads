# Deck Threads website

The public landing page for Deck Threads, built with Vinext and deployed to
`deck-threads.cognitive-dynamics.io`.

## Local development

```bash
npm install
npm run dev
```

## Validation

```bash
npm test
```

The site has no database, authentication, user accounts, analytics, or runtime
secrets. Its `/download/installer`, `/download/companion`, and
`/download/plugin` routes resolve only the newest complete stable GitHub
release and its matching standalone Stream Deck plugin.
Explicit `/download/beta/installer`, `/download/beta/companion`, and
`/download/beta/plugin` routes resolve the newest complete prerelease.
