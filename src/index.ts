export interface ServeSpaOptions {
  dist?: string;
  index?: string;
  indexInjectorPlaceholder?: string | RegExp;
  indexInjector?: (url: URL, req: Request) => string | Promise<string>;
  disabled?: boolean;
  disabledResponse?: Response;
}

export async function serveSpa({
  dist = "./dist",
  index = "index.html",
  indexInjectorPlaceholder = "<!-- bun-spa-placeholder -->",
  indexInjector,
  disabled = false,
  disabledResponse = new Response("bun-spa disabled", {
    status: 501
  })
}: ServeSpaOptions = {}): Promise<(req: Request) => Promise<Response>> {
  if (disabled) {
    return async () => disabledResponse.clone() as Response;
  }

  const files = new Map<string, { type: string; content: ArrayBuffer }>();

  for await (const entry of new Bun.Glob("**/*").scan(dist)) {
    const file = Bun.file(`${dist}/${entry}`);
    files.set(`/${entry}`, {
      type: file.type,
      content: await file.arrayBuffer()
    });
  }

  const indexFile = files.get(`/${index}`)!;
  const indexContent = new TextDecoder().decode(indexFile.content);

  return async (req: Request): Promise<Response> => {
    const url = new URL(req.url);
    const file = files.get(url.pathname);
    if (file) {
      return new Response(file.content, {
        headers: { "Content-Type": file.type }
      });
    }
    const content = !indexInjector
      ? indexContent
      : indexContent.replace(
          indexInjectorPlaceholder,
          await indexInjector(url, req)
        );
    return new Response(content, {
      headers: { "Content-Type": indexFile.type }
    });
  };
}
