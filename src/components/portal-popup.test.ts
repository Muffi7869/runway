import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { popupContainsTarget } from "./portal-popup";

function containingNode(inside: object): Pick<Node, "contains"> {
  return { contains: (target: Node | null) => target === inside };
}

describe("PortalPopup", () => {
  it("renders floating content into document.body after mount", () => {
    const source = readFileSync(new URL("./portal-popup.tsx", import.meta.url), "utf8");

    expect(source).toContain("createPortal(");
    expect(source).toContain("document.body");
    expect(source).toContain('position: "fixed"');
    expect(source).toContain("if (!mounted || !open) return null");
  });

  it("treats both the trigger and portaled surface as inside", () => {
    const triggerTarget = {};
    const popupTarget = {};
    const outsideTarget = {};

    expect(popupContainsTarget(triggerTarget as Node, containingNode(triggerTarget), containingNode(popupTarget))).toBe(true);
    expect(popupContainsTarget(popupTarget as Node, containingNode(triggerTarget), containingNode(popupTarget))).toBe(true);
    expect(popupContainsTarget(outsideTarget as Node, containingNode(triggerTarget), containingNode(popupTarget))).toBe(false);
  });
});
