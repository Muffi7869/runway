"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "../../lib/utils";

export function NavItem({
  badge,
  children,
  href,
  icon,
}: {
  badge?: number;
  children: ReactNode;
  href: string;
  icon?: ReactNode;
}) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={cn("ui-nav-item", active && "ui-nav-item--active")}
      href={href}
    >
      {icon}
      <span>{children}</span>
      {badge ? <span className="ui-nav-item__badge num">{badge}</span> : null}
    </Link>
  );
}
