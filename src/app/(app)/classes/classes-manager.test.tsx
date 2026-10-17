import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

const portalCapture = vi.hoisted(() => ({ children: undefined as ReactNode }));

vi.mock("./actions", () => ({ addClass: async () => ({}), updateClass: async () => ({}) }));
vi.mock("../../../components/portal-popup", () => ({
  PortalPopup: ({ children, open }: { children: ReactNode; open: boolean }) => {
    portalCapture.children = open ? children : undefined;
    return null;
  },
  popupContainsTarget: () => false,
}));

import { ColorPopover, shouldCloseColorPopover } from "./classes-manager";

describe("ColorPopover", () => {
  it("renders all eight choices when open", () => {
    const markup = renderToStaticMarkup(<ColorPopover initialOpen name="color" onChange={() => undefined} selectedColor="blue" />);
    const portal = renderToStaticMarkup(<div data-portal-target="document.body">{portalCapture.children}</div>);
    expect((portal.match(/role="radio"/g) ?? [])).toHaveLength(8);
    expect(markup).toContain('aria-expanded="true"');
    expect(markup).not.toContain('role="radiogroup"');
    expect(portal).toContain('data-portal-target="document.body"');
  });

  it("recognizes Escape as the close key", () => {
    expect(shouldCloseColorPopover("Escape")).toBe(true);
    expect(shouldCloseColorPopover("Enter")).toBe(false);
  });
});
