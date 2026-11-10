import {
  BarChart3, Bot, Boxes, Briefcase, Building2, ClipboardList, FileSearch, FileText, FolderOpen,
  Gauge, GitCompare, Inbox, MessageSquare, Receipt, Settings, ShoppingCart, Truck, Users, Wallet, Wrench,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Roadmap phase in which the module ships. Items without `ready` are shown as upcoming, not as links. */
  phase: number;
  ready?: boolean;
  adminOnly?: boolean;
};

export const NAV: NavItem[] = [
  { label: "Executive dashboard", href: "/", icon: Gauge, phase: 1, ready: true },
  { label: "Customers", href: "/customers", icon: Building2, phase: 2, ready: true },
  { label: "Suppliers", href: "/suppliers", icon: Boxes, phase: 2, ready: true },
  { label: "Quotations", href: "/quotations", icon: FileText, phase: 5, ready: true },
  { label: "Customer requests", href: "/requests", icon: Inbox, phase: 3 },
  { label: "Supplier RFQs", href: "/supplier-rfqs", icon: FileSearch, phase: 4 },
  { label: "Supplier quotations", href: "/supplier-quotes", icon: ClipboardList, phase: 4 },
  { label: "Quote comparison", href: "/comparison", icon: GitCompare, phase: 4 },
  { label: "Customer POs", href: "/customer-pos", icon: Receipt, phase: 6 },
  { label: "Sales orders", href: "/sales-orders", icon: Briefcase, phase: 6 },
  { label: "Supplier POs", href: "/supplier-pos", icon: ShoppingCart, phase: 7 },
  { label: "Service jobs", href: "/service-jobs", icon: Wrench, phase: 8 },
  { label: "Fulfillment", href: "/fulfillment", icon: Truck, phase: 9 },
  { label: "Documents", href: "/documents", icon: FolderOpen, phase: 3 },
  { label: "Communications", href: "/communications", icon: MessageSquare, phase: 4 },
  { label: "Finance", href: "/finance", icon: Wallet, phase: 9 },
  { label: "Operations assistant", href: "/assistant", icon: Bot, phase: 10 },
  { label: "Reports", href: "/reports", icon: BarChart3, phase: 10 },
  { label: "Administration", href: "/admin/users", icon: Settings, phase: 1, ready: true, adminOnly: true },
];

export const TEAM_ICON = Users;
