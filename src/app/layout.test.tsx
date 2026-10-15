import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const themeCookie = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("next/font/google", () => ({
  Geist: () => ({ variable: "font-sans-test" }),
  Geist_Mono: () => ({ variable: "font-mono-test" }),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: themeCookie.get })),
}));

import RootLayout from "./layout";

describe("root theme markup", () => {
  it("puts an explicit light cookie in the first HTML", async () => {
    themeCookie.get.mockReturnValue({ value: "light" });
    const layout = await RootLayout({ children: <p>Content</p> });
    const markup = renderToStaticMarkup(layout);

    expect(markup).toContain('data-theme="light"');
  });

  it("leaves a system cookie for the pre-paint script to resolve", async () => {
    themeCookie.get.mockReturnValue({ value: "system" });
    const layout = await RootLayout({ children: <p>Content</p> });
    const markup = renderToStaticMarkup(layout);

    expect(markup).not.toContain("data-theme=");
    expect(markup).toContain("runway-theme");
    expect(markup).toContain("prefers-color-scheme: dark");
  });
});
