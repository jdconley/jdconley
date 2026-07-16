import { describe, expect, it } from "vitest";
import worker from "../../worker/index.js";

describe("Worker assets", () => {
  it("delegates unrelated routes to the static-assets binding", async () => {
    const requested = [];
    const env = {
      ASSETS: {
        fetch: async (request) => {
          requested.push(new URL(request.url).pathname);
          return new Response("<h1>Hi, I’m JD</h1>", { status: 200 });
        }
      }
    };

    const response = await worker.fetch(new Request("https://jdconley.test/"), env);

    expect(requested).toEqual(["/"]);
    expect(await response.text()).toContain("Hi, I’m JD");
  });
});
