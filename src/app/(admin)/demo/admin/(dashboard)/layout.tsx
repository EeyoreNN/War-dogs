import { DashboardNav } from "@/components/admin/dashboard-nav";

/** Dashboard tabs are routes (§4.8): a `<nav aria-label="Dashboard">` of links, never `Tabs`. */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[1280px] px-4 pt-4 pb-16 sm:px-6 lg:px-10">
      <DashboardNav />
      <div className="pt-6">{children}</div>
    </div>
  );
}
