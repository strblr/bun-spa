export interface BunSpaOptions {
  dist?: string;
  glob?: string;
  index?: string;
  indexInjectorPlaceholder?: string | RegExp;
  indexInjector?: (options: BunSpaCallbackOptions) => string | Promise<string>;
  headers?: (
    options: BunSpaCallbackOptions
  ) => Record<string, string> | Promise<Record<string, string>>;
  disabled?: boolean;
  disabledResponse?: Response;
}

export interface BunSpaCallbackOptions {
  url: URL;
  req: Request;
  file: BunSpaFile;
}

export interface BunSpaFile {
  type: string;
  content: ArrayBuffer;
  file: Bun.BunFile;
  isIndex: boolean;
}

export async function bunSpa({
  dist = "./dist",
  glob = "**/*",
  index = "index.html",
  indexInjectorPlaceholder = "<!-- bun-spa-placeholder -->",
  indexInjector,
  headers,
  disabled = false,
  disabledResponse = new Response("bun-spa disabled", {
    status: 501
  })
}: BunSpaOptions = {}): Promise<(req: Request) => Promise<Response>> {
  if (disabled) {
    return async () => disabledResponse.clone() as Response;
  }

  const files = new Map<string, BunSpaFile>();

  for await (const entry of new Bun.Glob(glob).scan(dist)) {
    const file = Bun.file(`${dist}/${entry}`);
    files.set(`/${entry}`, {
      type: file.type,
      content: await file.arrayBuffer(),
      file,
      isIndex: entry === index
    });
  }

  const indexFile = files.get(`/${index}`)!;
  const indexContent = new TextDecoder().decode(indexFile.content);

  return async (req: Request): Promise<Response> => {
    const url = new URL(req.url);
    const file = files.get(url.pathname) ?? indexFile;

    let body: ArrayBuffer | string;
    if (!file.isIndex || !indexInjector) {
      body = file.content;
    } else {
      const injected = await indexInjector({ url, req, file });
      body = indexContent.replace(indexInjectorPlaceholder, () => injected);
    }

    return new Response(body, {
      headers: {
        "Content-Type": file.type,
        ...(await headers?.({ url, req, file }))
      }
    });
  };
}
