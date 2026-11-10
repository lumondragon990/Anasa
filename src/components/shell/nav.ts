import {
  BarChart3, Bot, Boxes, Briefcase, Building2, ClipboardList, FileSearch, FileText, FolderOpen,
  Gauge, GitCompare, Inbox, MessageSquare, Receipt, Settings, ShoppingCart, Truck, Users, Wallet, Wrench,
  type LucideIcon,
} from "lucide-react";

export type NavKey =
  | "dashboard" | "customers" | "suppliers" | "quotations" | "requests" | "supplierRfqs" | "supplierQuotes"
  | "comparison" | "customerPos" | "salesOrders" | "supplierPos" | "serviceJobs" | "fulfillment" | "documents"
  | "communications" | "finance" | "assistant" | "reports" | "admin";

export type NavItem = {
  /** Key in the `nav` section of the dictionaries. */
  label: NavKey;
  href: string;
  icon: LucideIcon;
  /** Roadmap phase in which the module ships. Items without `ready` are shown as upcoming, not as links. */
  phase: number;
  ready?: boolean;
  adminOnly?: boolean;
};

export const NAV: NavItem[] = [
  { label: "dashboard", href: "/", icon: Gauge, phase: 1, ready: true },
  { label: "customers", href: "/customers", icon: Building2, phase: 2, ready: true },
  { label: "suppliers", href: "/suppliers", icon: Boxes, phase: 2, ready: true },
  { label: "quotations", href: "/quotations", icon: FileText, phase: 5, ready: true },
  { label: "salesOrders", href: "/sales-orders", icon: Briefcase, phase: 6, ready: true },
  { label: "requests", href: "/requests", icon: Inbox, phase: 3 },
  { label: "supplierRfqs", href: "/supplier-rfqs", icon: FileSearch, phase: 4 },
  { label: "supplierQuotes", href: "/supplier-quotes", icon: ClipboardList, phase: 4 },
  { label: "comparison", href: "/comparison", icon: GitCompare, phase: 4 },
  { label: "customerPos", href: "/customer-pos", icon: Receipt, phase: 6 },
  { label: "supplierPos", href: "/supplier-pos", icon: ShoppingCart, phase: 7 },
  { label: "serviceJobs", href: "/service-jobs", icon: Wrench, phase: 8 },
  { label: "fulfillment", href: "/fulfillment", icon: Truck, phase: 9 },
  { label: "documents", href: "/documents", icon: FolderOpen, phase: 3 },
  { label: "communications", href: "/communications", icon: MessageSquare, phase: 4 },
  { label: "finance", href: "/finance", icon: Wallet, phase: 9 },
  { label: "assistant", href: "/assistant", icon: Bot, phase: 10 },
  { label: "reports", href: "/reports", icon: BarChart3, phase: 10 },
  { label: "admin", href: "/admin/users", icon: Settings, phase: 1, ready: true, adminOnly: true },
];

export const TEAM_ICON = Users;
