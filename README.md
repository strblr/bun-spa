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
import { bunSpa } from "bun-spa";

const app = await bunSpa();

Bun.serve({
  routes: {
    "/*": app
  }
});
```

### Inject runtime content (optional)

Add a placeholder to your `index.html` (defaults to `<!-- bun-spa-placeholder -->`) and provide an `indexInjector` to replace it at request time. Useful for adding meta tags on the fly for social media previews.

**IMPORTANT: If you inject user-provided content, make sure to escape it and follow strict guidelines to prevent security issues. See [escape-goat](https://www.npmjs.com/package/escape-goat), [escape-html](https://www.npmjs.com/package/escape-html), [sanitize-html](https://www.npmjs.com/package/sanitize-html), etc.**

```ts
import { htmlEscape } from "escape-goat";

const app = await bunSpa({
  indexInjector: async ({ url }) =>
    `<meta property="og:description" content="${htmlEscape(
      await fetchDescription(url)
    )}">`
});
```

### Dynamic headers (optional)

Provide a `headers` callback to set per-request headers. These merge with the default `Content-Type` the server sets based on the file.

```ts
const app = await bunSpa({
  headers: ({ file }) => ({
    "Cache-Control": file.isIndex
      ? "no-store"
      : "public, max-age=31536000, immutable"
  })
});
```

### API

```ts
bunSpa(options?: BunSpaOptions): Promise<(req: Request) => Promise<Response>>
```

`BunSpaOptions`:

| Option                     | Type                                                                                            | Default                                             | Description                                                                                              |     |
| -------------------------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | --- |
| `dist`                     | `string`                                                                                        | `"./dist"`                                          | Directory scanned at startup; files cached in memory.                                                    |     |
| `glob`                     | `string`                                                                                        | `"**/*"`                                            | Glob pattern for which files to load from `dist/`. Uses [Bun.Glob](https://bun.sh/docs/api/glob) syntax. |     |
| `index`                    | `string`                                                                                        | `"index.html"`                                      | SPA entry file served as fallback for unknown routes.                                                    |     |
| `indexInjectorPlaceholder` | `string \| RegExp`                                                                              | `"<!-- bun-spa-placeholder -->"`                    | Marker in `index.html` to be replaced at request time. Typically a comment.                              |
| `indexInjector`            | `(options: BunSpaCallbackOptions) => string \| Promise<string>`                                 | `undefined`                                         | Returns a string that replaces the placeholder in `index.html`.                                          |
| `headers`                  | `(options: BunSpaCallbackOptions) => Record<string, string> \| Promise<Record<string, string>>` | `undefined`                                         | Additional headers to send with the response. Merged with default `Content-Type`.                        |
| `disabled`                 | `boolean`                                                                                       | `false`                                             | If `true`, the returned handler always responds with `disabledResponse`. Files aren't loaded.            |     |
| `disabledResponse`         | `Response`                                                                                      | `new Response("bun-spa disabled", { status: 501 })` | Response returned when `disabled` is `true`.                                                             |     |

Other types:

```ts
interface BunSpaCallbackOptions {
  url: URL;
  req: Request;
  file: BunSpaFile;
}

interface BunSpaFile {
  type: string;
  content: ArrayBuffer;
  file: Bun.BunFile;
  isIndex: boolean;
}
```

### Notes

- Files are read once at startup and kept in memory for fast responses.
- All unknown paths return `index.html` (with optional injection).
- TypeScript types are included.
