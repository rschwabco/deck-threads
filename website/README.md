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
secrets. Its `/download/installer` and `/download/companion` routes resolve the
newest complete published GitHub release, including prereleases, and redirect
to the signed package assets.
