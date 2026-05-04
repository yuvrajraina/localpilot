# LocalPilot Frontend

React documentation site for LocalPilot, ready for Netlify deployment.

## Netlify Settings

Use `localpilot-vscode/frontend` as the Netlify site base directory.

- Build command: `npm run build`
- Publish directory: `dist`
- Node version: `22.12.0`

These settings are also captured in `netlify.toml`. The production build uses React Router, so
Netlify redirects all routes to `index.html`.

## Local Development

```bash
npm install
npm run dev
```

## Production Build

```bash
npm run build
```

The generated `dist` folder includes security headers, cache headers, `robots.txt`, the product
icon, and hashed Vite assets.
