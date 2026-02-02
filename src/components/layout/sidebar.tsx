"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FlaskConical,
  TestTubes,
  Activity,
  Settings,
  ChevronLeft,
  ChevronRight,
  FileBarChart,
  Users,
  Bell,
  Brain,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const navigation = [
  {
    name: "Overview",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    name: "Experiments",
    href: "/experiments",
    icon: FlaskConical,
  },
  {
    name: "Samples",
    href: "/samples",
    icon: TestTubes,
  },
  {
    name: "Results",
    href: "/results",
    icon: FileBarChart,
  },
  {
    name: "Processing",
    href: "/jobs",
    icon: Activity,
  },
  {
    name: "Models",
    href: "/models",
    icon: Brain,
  },
];

const secondaryNavigation = [
  {
    name: "Team",
    href: "/team",
    icon: Users,
  },
  {
    name: "Notifications",
    href: "/notifications",
    icon: Bell,
  },
  {
    name: "Settings",
    href: "/settings",
    icon: Settings,
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "flex flex-col border-r bg-card transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center border-b px-4">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <FlaskConical className="h-5 w-5" />
          </div>
          {!collapsed && (
            <span className="text-lg font-semibold">Diagnostics</span>
          )}
        </Link>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 space-y-1 p-3">
        <div className={cn("mb-2", !collapsed && "px-3")}>
          {!collapsed && (
            <span className="text-xs font-medium uppercase text-muted-foreground">
              Main
            </span>
          )}
        </div>
        {navigation.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
                collapsed && "justify-center px-2"
              )}
              title={collapsed ? item.name : undefined}
            >
              <item.icon className="h-5 w-5 flex-shrink-0" />
              {!collapsed && <span>{item.name}</span>}
            </Link>
          );
        })}

        <div className={cn("mb-2 mt-6", !collapsed && "px-3")}>
          {!collapsed && (
            <span className="text-xs font-medium uppercase text-muted-foreground">
              Settings
            </span>
          )}
        </div>
        {secondaryNavigation.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
                collapsed && "justify-center px-2"
              )}
              title={collapsed ? item.name : undefined}
            >
              <item.icon className="h-5 w-5 flex-shrink-0" />
              {!collapsed && <span>{item.name}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Collapse Button */}
      <div className="border-t p-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed(!collapsed)}
          className={cn("w-full", collapsed && "px-2")}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4 mr-2" />
              <span>Collapse</span>
            </>
          )}
        </Button>
      </div>
    </aside>
  );
}
