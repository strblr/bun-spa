### bun-spa

Serve bundled SPAs (like a `vite build`) from a Bun server, fast and simple.

- **What it does**: Loads your built files from `dist/` (customizable) at startup, caches them in memory, and serves them. Unknown routes fall back to `index.html` (also customizable).
- **Why it’s fast**: Everything is served directly from memory after the initial load. There are no disk reads during requests.

### Install

```sh
bun add bun-spa
```

### Quick start

```ts
import { serveSpa } from "bun-spa";

const app = await serveSpa();

Bun.serve({
  routes: {
    "/*": app
  }
});
```

### Inject runtime content (optional)

Add a placeholder to your `index.html` (defaults to `<!-- bun-spa-placeholder -->`) and provide an `indexInjector` to replace it at request time. Useful for adding meta tags on the fly for social media previews.

**IMPORTANT: If you inject user-provided content, make sure to sanitize the whole injection to prevent security issues. See [sanitize-html](https://www.npmjs.com/package/sanitize-html).**

```ts
const fetch = await serveSpa({
  indexInjector: url =>
    `<meta property="og:url" content="https://example.com${url.pathname}" />`
});
```

### API

```ts
serveSpa(options?: ServeSpaOptions): Promise<(req: Request) => Promise<Response>>
```

Options:

| Option                     | Type                                                    | Default                                             | Description                                                                                              |     |
| -------------------------- | ------------------------------------------------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | --- |
| `dist`                     | `string`                                                | `"./dist"`                                          | Directory scanned at startup; files cached in memory.                                                    |     |
| `glob`                     | `string`                                                | `"**/*"`                                            | Glob pattern for which files to load from `dist/`. Uses [Bun.Glob](https://bun.sh/docs/api/glob) syntax. |     |
| `index`                    | `string`                                                | `"index.html"`                                      | SPA entry file served as fallback for unknown routes.                                                    |     |
| `indexInjectorPlaceholder` | `string \| RegExp`                                      | `"<!-- bun-spa-placeholder -->"`                    | Marker in `index.html` to be replaced at request time. Typically a comment.                              |
| `indexInjector`            | `(url: URL, req: Request) => string \| Promise<string>` | `undefined`                                         | Returns HTML that replaces the placeholder in `index.html`.                                              |
| `disabled`                 | `boolean`                                               | `false`                                             | If `true`, the returned handler always responds with `disabledResponse`. Files aren't loaded.            |     |
| `disabledResponse`         | `Response`                                              | `new Response("bun-spa disabled", { status: 501 })` | Response returned when `disabled` is `true`.                                                             |     |

### Notes

- Files are read once at startup and kept in memory for fast responses.
- All unknown paths return `index.html` (with optional injection).
- TypeScript types are included.
