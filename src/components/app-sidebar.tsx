import Link from "next/link";
import {
  BookOpen,
  CalendarDays,
  CheckCircle2,
  List,
  LogOut,
  SlidersHorizontal,
} from "lucide-react";

import { signOut } from "@/app/(app)/actions";
import { buttonClassName } from "@/components/ui/button";
import { NavItem } from "@/components/ui/nav-item";

import { RunwayLogo } from "./runway-logo";

export type SidebarSyncState = {
  state: "connected" | "needs_reconnect" | "none";
  label: string;
};

export function AppSidebar({
  checkinBadge,
  sync,
  userName,
}: {
  checkinBadge?: number;
  sync?: SidebarSyncState;
  userName: string;
}) {
  const iconProps = { "aria-hidden": true as const, size: 18, strokeWidth: 1.6 };
  const initial = userName.trim().charAt(0).toUpperCase() || "R";

  return (
    <aside className="app-sidebar">
      <Link className="app-logo" href="/week">
        <RunwayLogo />
        <span>Runway</span>
      </Link>

      <nav aria-label="Main" className="app-sidebar__nav">
        <NavItem href="/week" icon={<CalendarDays {...iconProps} />}>
          Week
        </NavItem>
        <NavItem
          badge={checkinBadge}
          href="/checkin"
          icon={<CheckCircle2 {...iconProps} />}
        >
          Check in
        </NavItem>
        <NavItem href="/assignments" icon={<List {...iconProps} />}>
          Assignments
        </NavItem>
        <NavItem href="/classes" icon={<BookOpen {...iconProps} />}>
          Classes
        </NavItem>
        <NavItem href="/settings" icon={<SlidersHorizontal {...iconProps} />}>
          Settings
        </NavItem>
      </nav>

      <div className="app-sidebar__footer">
        {sync ? (
          <div className="app-sync-status" data-state={sync.state}>
            <span className="app-sync-status__dot" />
            <span>{sync.label}</span>
          </div>
        ) : null}
        <div className="app-user">
          <span aria-hidden="true" className="app-user__avatar">
            {initial}
          </span>
          <span>{userName}</span>
          <form action={signOut}>
            <button className={buttonClassName("ghost")} type="submit">
              <LogOut aria-hidden="true" size={18} strokeWidth={1.6} />
              Sign out
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
