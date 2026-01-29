"use client";

import {
  createContext,
  use,
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";

// Types
export interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
  badge?: number;
  children?: NavItem[];
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

// State
export interface SidebarState {
  collapsed: boolean;
  expandedItems: Set<string>;
  pathname: string;
}

// Actions
export interface SidebarActions {
  toggleCollapse: () => void;
  setCollapsed: (collapsed: boolean) => void;
  toggleExpanded: (href: string) => void;
  isActive: (href: string, exact?: boolean) => boolean;
}

// Meta
export interface SidebarMeta {
  navSections: NavSection[];
}

interface SidebarContextValue {
  state: SidebarState;
  actions: SidebarActions;
  meta: SidebarMeta;
}

const SidebarContext = createContext<SidebarContextValue | undefined>(undefined);

export interface SidebarProviderProps {
  children: ReactNode;
  navSections: NavSection[];
  defaultCollapsed?: boolean;
}

export function SidebarProvider({
  children,
  navSections,
  defaultCollapsed = false,
}: SidebarProviderProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const toggleCollapse = useCallback(() => {
    setCollapsed((prev) => !prev);
  }, []);

  const toggleExpanded = useCallback((href: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(href)) {
        next.delete(href);
      } else {
        next.add(href);
      }
      return next;
    });
  }, []);

  const isActive = useCallback(
    (href: string, exact?: boolean) => {
      if (href === "/dashboard") {
        return pathname === "/dashboard" || pathname === "/";
      }
      if (exact) {
        return pathname === href;
      }
      return pathname.startsWith(href);
    },
    [pathname]
  );

  // Auto-expand items that have active children
  useEffect(() => {
    navSections.forEach((section) => {
      section.items.forEach((item) => {
        if (item.children && pathname.startsWith(item.href)) {
          setExpandedItems((prev) => new Set([...prev, item.href]));
        }
      });
    });
  }, [pathname, navSections]);

  const state: SidebarState = {
    collapsed,
    expandedItems,
    pathname,
  };

  const actions: SidebarActions = {
    toggleCollapse,
    setCollapsed,
    toggleExpanded,
    isActive,
  };

  const meta: SidebarMeta = {
    navSections,
  };

  return (
    <SidebarContext value={{ state, actions, meta }}>
      {children}
    </SidebarContext>
  );
}

export function useSidebar(): SidebarContextValue {
  const context = use(SidebarContext);
  if (context === undefined) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
}
