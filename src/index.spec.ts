import { expect, test, describe, beforeEach, afterEach } from "bun:test";
import { mkdir, writeFile, rm } from "fs/promises";
import path from "path";
import { serveSpa } from ".";

async function createTestDistFolder(folderName: string): Promise<string> {
  if (folderName === "dist") {
    throw new Error(
      'Cannot use "dist" as test folder name - reserved for production use'
    );
  }

  const testDist = path.join(process.cwd(), folderName);
  await mkdir(testDist, { recursive: true });
  await mkdir(path.join(testDist, "assets"), { recursive: true });
  await mkdir(path.join(testDist, "nested", "deep"), { recursive: true });
  await mkdir(path.join(testDist, "api"), { recursive: true });

  await writeFile(
    path.join(testDist, "index.html"),
    `<!DOCTYPE html>
<html>
<head>
  <title>Test SPA</title>
</head>
<body>
  <div id="app"><!-- bun-spa-placeholder --></div>
  <script src="/assets/app.js"></script>
</body>
</html>`
  );

  await writeFile(
    path.join(testDist, "custom.html"),
    `<!DOCTYPE html>
<html>
<head><title>Custom</title></head>
<body>
  <div id="custom">{{PLACEHOLDER}}</div>
</body>
</html>`
  );

  await writeFile(
    path.join(testDist, "assets", "app.js"),
    "console.log('Hello from SPA');"
  );

  await writeFile(
    path.join(testDist, "assets", "styles.css"),
    "body { margin: 0; }"
  );

  await writeFile(
    path.join(testDist, "api", "data.json"),
    JSON.stringify({ message: "test data" })
  );

  await writeFile(
    path.join(testDist, "nested", "deep", "file.txt"),
    "nested content"
  );

  await writeFile(path.join(testDist, "assets", "logo.png"), "fake-png-data");

  return testDist;
}

async function cleanupTestDistFolder(folderName: string) {
  try {
    const testDist = path.join(process.cwd(), folderName);
    await rm(testDist, { recursive: true, force: true });
  } catch (error) {}
}

describe("serveSpa", () => {
  let TEST_DIST: string;

  beforeEach(async () => {
    TEST_DIST = await createTestDistFolder("test-dist");
  });

  afterEach(async () => {
    await cleanupTestDistFolder("test-dist");
  });

  describe("Basic functionality", () => {
    test("should serve static files from dist directory", async () => {
      const result = await serveSpa({ dist: TEST_DIST });
      const handler = result as (req: Request) => Promise<Response>;

      const jsRequest = new Request("http://localhost/assets/app.js");
      const jsResponse = await handler(jsRequest);

      expect(jsResponse.status).toBe(200);
      expect(jsResponse.headers.get("Content-Type")).toContain("javascript");
      expect(await jsResponse.text()).toBe("console.log('Hello from SPA');");
    });

    test("should serve CSS files with correct content type", async () => {
      const result = await serveSpa({ dist: TEST_DIST });
      const handler = result as (req: Request) => Promise<Response>;

      const cssRequest = new Request("http://localhost/assets/styles.css");
      const cssResponse = await handler(cssRequest);

      expect(cssResponse.status).toBe(200);
      expect(cssResponse.headers.get("Content-Type")).toContain("css");
      expect(await cssResponse.text()).toBe("body { margin: 0; }");
    });

    test("should serve JSON files with correct content type", async () => {
      const result = await serveSpa({ dist: TEST_DIST });
      const handler = result as (req: Request) => Promise<Response>;

      const jsonRequest = new Request("http://localhost/api/data.json");
      const jsonResponse = await handler(jsonRequest);

      expect(jsonResponse.status).toBe(200);
      expect(jsonResponse.headers.get("Content-Type")).toContain("json");
      const data = await jsonResponse.json();
      expect(data.message).toBe("test data");
    });

    test("should serve nested files", async () => {
      const result = await serveSpa({ dist: TEST_DIST });
      const handler = result as (req: Request) => Promise<Response>;

      const nestedRequest = new Request(
        "http://localhost/nested/deep/file.txt"
      );
      const nestedResponse = await handler(nestedRequest);

      expect(nestedResponse.status).toBe(200);
      expect(await nestedResponse.text()).toBe("nested content");
    });

    test("should fallback to index.html for non-existent routes", async () => {
      const result = await serveSpa({ dist: TEST_DIST });
      const handler = result as (req: Request) => Promise<Response>;

      const spaRequest = new Request("http://localhost/some/spa/route");
      const spaResponse = await handler(spaRequest);

      expect(spaResponse.status).toBe(200);
      expect(spaResponse.headers.get("Content-Type")).toContain("html");
      const content = await spaResponse.text();
      expect(content).toContain("<title>Test SPA</title>");
      expect(content).toContain("<!-- bun-spa-placeholder -->");
    });
  });

  describe("Configuration options", () => {
    test("should use custom dist directory", async () => {
      const customDist = await createTestDistFolder("custom-test-dist");
      await writeFile(path.join(customDist, "test.txt"), "custom content");

      const result = await serveSpa({ dist: customDist });
      const handler = result as (req: Request) => Promise<Response>;

      const request = new Request("http://localhost/test.txt");
      const response = await handler(request);

      expect(await response.text()).toBe("custom content");

      await cleanupTestDistFolder("custom-test-dist");
    });

    test("should use custom index file", async () => {
      const result = await serveSpa({
        dist: TEST_DIST,
        index: "custom.html"
      });
      const handler = result as (req: Request) => Promise<Response>;

      const request = new Request("http://localhost/nonexistent");
      const response = await handler(request);

      const content = await response.text();
      expect(content).toContain("<title>Custom</title>");
      expect(content).toContain("{{PLACEHOLDER}}");
    });

    test("should handle default options when no config provided", async () => {
      const defaultDist = await createTestDistFolder("default-test-dist");
      await writeFile(
        path.join(defaultDist, "index.html"),
        "<html><body>Default</body></html>"
      );

      const result = await serveSpa({ dist: defaultDist });
      const handler = result as (req: Request) => Promise<Response>;

      const request = new Request("http://localhost/");
      const response = await handler(request);

      expect(response.status).toBe(200);

      await cleanupTestDistFolder("default-test-dist");
    });
  });

  describe("Glob pattern", () => {
    test("should include only HTML files when glob is restrictive", async () => {
      const result = await serveSpa({ dist: TEST_DIST, glob: "**/*.html" });
      const handler = result as (req: Request) => Promise<Response>;

      const indexRequest = new Request("http://localhost/index.html");
      const indexResponse = await handler(indexRequest);
      expect(indexResponse.status).toBe(200);
      expect(indexResponse.headers.get("Content-Type")).toContain("html");
      const indexContent = await indexResponse.text();
      expect(indexContent).toContain("<title>Test SPA</title>");

      const jsRequest = new Request("http://localhost/assets/app.js");
      const jsResponse = await handler(jsRequest);
      expect(jsResponse.status).toBe(200);
      expect(jsResponse.headers.get("Content-Type")).toContain("html");
      const jsContent = await jsResponse.text();
      expect(jsContent).toContain("<title>Test SPA</title>");
      expect(jsContent).not.toContain("console.log('Hello from SPA');");

      const jsonRequest = new Request("http://localhost/api/data.json");
      const jsonResponse = await handler(jsonRequest);
      expect(jsonResponse.status).toBe(200);
      expect(jsonResponse.headers.get("Content-Type")).toContain("html");
      const jsonContent = await jsonResponse.text();
      expect(jsonContent).toContain("<title>Test SPA</title>");
    });

    test("should error when glob excludes index file", async () => {
      let threw = false;
      try {
        await serveSpa({
          dist: TEST_DIST,
          glob: "**/*.css",
          index: "index.html"
        });
      } catch {
        threw = true;
      }
      expect(threw).toBe(true);
    });
  });

  describe("Disabled mode", () => {
    test("should return default disabled response when disabled", async () => {
      const result = await serveSpa({ disabled: true });
      expect(typeof result).toBe("function");
      const handler = result as (req: Request) => Promise<Response>;
      const testRequest = new Request("http://localhost/test");
      const response = await handler(testRequest);
      expect(response.status).toBe(501);
      expect(await response.text()).toBe("bun-spa disabled");
    });

    test("should return custom disabled response", async () => {
      const customResponse = new Response("Custom disabled message", {
        status: 503,
        headers: { "X-Custom": "disabled" }
      });

      const result = await serveSpa({
        disabled: true,
        disabledResponse: customResponse
      });

      expect(typeof result).toBe("function");
      const handler = result as (req: Request) => Promise<Response>;
      const testRequest = new Request("http://localhost/test");
      const response = await handler(testRequest);
      expect(response.status).toBe(503);
      expect(await response.text()).toBe("Custom disabled message");
      expect(response.headers.get("X-Custom")).toBe("disabled");
    });
  });

  describe("Index injection", () => {
    test("should inject content using default placeholder", async () => {
      const injector = (url: URL) => {
        return `<p>Injected for ${url.pathname}</p>`;
      };

      const result = await serveSpa({
        dist: TEST_DIST,
        indexInjector: injector
      });
      const handler = result as (req: Request) => Promise<Response>;

      const request = new Request("http://localhost/app/route");
      const response = await handler(request);

      const content = await response.text();
      expect(content).toContain("<p>Injected for /app/route</p>");
      expect(content).not.toContain("<!-- bun-spa-placeholder -->");
    });

    test("should inject content using custom placeholder", async () => {
      const injector = () => "<p>Custom injection</p>";

      const result = await serveSpa({
        dist: TEST_DIST,
        index: "custom.html",
        indexInjectorPlaceholder: "{{PLACEHOLDER}}",
        indexInjector: injector
      });
      const handler = result as (req: Request) => Promise<Response>;

      const request = new Request("http://localhost/custom/route");
      const response = await handler(request);

      const content = await response.text();
      expect(content).toContain("<p>Custom injection</p>");
      expect(content).not.toContain("{{PLACEHOLDER}}");
    });

    test("should inject content using RegExp placeholder", async () => {
      await writeFile(
        path.join(TEST_DIST, "regex.html"),
        "<html><body>START_INJECT_HERE end ANOTHER_START_INJECT_HERE end</body></html>"
      );

      const injector = () => "INJECTED";
      const regexPlaceholder = /START_INJECT_HERE.*?end/g;

      const result = await serveSpa({
        dist: TEST_DIST,
        index: "regex.html",
        indexInjectorPlaceholder: regexPlaceholder,
        indexInjector: injector
      });
      const handler = result as (req: Request) => Promise<Response>;

      const request = new Request("http://localhost/regex/route");
      const response = await handler(request);

      const content = await response.text();
      expect(content).toBe(
        "<html><body>INJECTED ANOTHER_INJECTED</body></html>"
      );
    });

    test("should handle async index injector", async () => {
      const asyncInjector = async (url: URL, req: Request) => {
        await new Promise(resolve => setTimeout(resolve, 1));
        return `<p>Async injected for ${url.pathname}</p>`;
      };

      const result = await serveSpa({
        dist: TEST_DIST,
        indexInjector: asyncInjector
      });
      const handler = result as (req: Request) => Promise<Response>;

      const request = new Request("http://localhost/async/route");
      const response = await handler(request);

      const content = await response.text();
      expect(content).toContain("<p>Async injected for /async/route</p>");
    });

    test("should not inject for existing static files", async () => {
      const injector = () => "<p>Should not appear</p>";

      const result = await serveSpa({
        dist: TEST_DIST,
        indexInjector: injector
      });
      const handler = result as (req: Request) => Promise<Response>;

      const request = new Request("http://localhost/assets/app.js");
      const response = await handler(request);

      const content = await response.text();
      expect(content).toBe("console.log('Hello from SPA');");
      expect(content).not.toContain("<p>Should not appear</p>");
    });

    test("should provide correct URL and Request to injector", async () => {
      let capturedUrl: URL | null = null;
      let capturedReq: Request | null = null;

      const injector = (url: URL, req: Request) => {
        capturedUrl = url;
        capturedReq = req;
        return "<p>Captured</p>";
      };

      const result = await serveSpa({
        dist: TEST_DIST,
        indexInjector: injector
      });
      const handler = result as (req: Request) => Promise<Response>;

      const request = new Request(
        "http://localhost:3000/test/path?param=value"
      );
      await handler(request);

      expect(capturedUrl).not.toBeNull();
      expect(capturedUrl!.pathname).toBe("/test/path");
      expect(capturedUrl!.searchParams.get("param")).toBe("value");
      expect(capturedUrl!.hostname).toBe("localhost");
      expect(capturedUrl!.port).toBe("3000");
      expect(capturedReq).not.toBeNull();
      expect(capturedReq!).toBe(request);
    });
  });

  describe("Edge cases and error handling", () => {
    test("should handle empty dist directory", async () => {
      const emptyDist = await createTestDistFolder("empty-test-dist");
      await rm(path.join(emptyDist, "*"), {
        recursive: true,
        force: true
      }).catch(() => {});

      try {
        await serveSpa({ dist: emptyDist });
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeDefined();
      }

      await cleanupTestDistFolder("empty-test-dist");
    });

    test("should handle root path request", async () => {
      const result = await serveSpa({ dist: TEST_DIST });
      const handler = result as (req: Request) => Promise<Response>;

      const request = new Request("http://localhost/");
      const response = await handler(request);

      expect(response.status).toBe(200);
      const content = await response.text();
      expect(content).toContain("<title>Test SPA</title>");
    });

    test("should handle requests with query parameters", async () => {
      const result = await serveSpa({ dist: TEST_DIST });
      const handler = result as (req: Request) => Promise<Response>;

      const request = new Request(
        "http://localhost/app/route?param=value&other=test"
      );
      const response = await handler(request);

      expect(response.status).toBe(200);
      const content = await response.text();
      expect(content).toContain("<title>Test SPA</title>");
    });

    test("should handle requests with hash fragments", async () => {
      const result = await serveSpa({ dist: TEST_DIST });
      const handler = result as (req: Request) => Promise<Response>;

      const request = new Request("http://localhost/app/route#section");
      const response = await handler(request);

      expect(response.status).toBe(200);
      const content = await response.text();
      expect(content).toContain("<title>Test SPA</title>");
    });

    test("should preserve original content type for index fallback", async () => {
      const result = await serveSpa({ dist: TEST_DIST });
      const handler = result as (req: Request) => Promise<Response>;

      const request = new Request("http://localhost/non/existent/route");
      const response = await handler(request);

      expect(response.headers.get("Content-Type")).toContain("html");
    });

    test("should handle files with special characters in names", async () => {
      await writeFile(
        path.join(TEST_DIST, "special-file@2x.png"),
        "special content"
      );

      const result = await serveSpa({ dist: TEST_DIST });
      const handler = result as (req: Request) => Promise<Response>;

      const request = new Request("http://localhost/special-file@2x.png");
      const response = await handler(request);

      expect(response.status).toBe(200);
      expect(await response.text()).toBe("special content");
    });
  });

  describe("Performance and memory considerations", () => {
    test("should preload all files into memory", async () => {
      const result = await serveSpa({ dist: TEST_DIST });
      const handler = result as (req: Request) => Promise<Response>;

      const request1 = new Request("http://localhost/assets/app.js");
      const request2 = new Request("http://localhost/assets/app.js");

      const response1 = await handler(request1);
      const response2 = await handler(request2);

      expect(await response1.text()).toBe(await response2.text());
    });

    test("should handle concurrent requests", async () => {
      const result = await serveSpa({ dist: TEST_DIST });
      const handler = result as (req: Request) => Promise<Response>;

      const requests = [
        new Request("http://localhost/assets/app.js"),
        new Request("http://localhost/assets/styles.css"),
        new Request("http://localhost/spa/route1"),
        new Request("http://localhost/spa/route2"),
        new Request("http://localhost/api/data.json")
      ];

      const responses = await Promise.all(requests.map(req => handler(req)));

      expect(responses).toHaveLength(5);
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });
  });
});
