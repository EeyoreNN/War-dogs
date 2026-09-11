import { AdminStrip } from "@/components/admin/admin-strip";
import { SimProvider } from "@/components/admin/sim-provider";
import { Toaster } from "@/components/ui/toast";

/**
 * The admin demo shell (§3.14): its own 48 px strip, no SiteHeader / SiteFooter. One
 * simulation per tab lives in `SimProvider`, so the landing card and the dashboard agree.
 */
export default function AdminLayout({ children }: LayoutProps<"/demo/admin">) {
  return (
    <SimProvider>
      <div className="flex min-h-dvh flex-col bg-bg-0">
        <a
          href="#main"
          className="sr-only rounded bg-accent px-3 py-2 font-semibold text-accent-ink focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100]"
        >
          Skip to content
        </a>
        <AdminStrip />
        <main id="main" className="min-h-dvh flex-1">
          {children}
        </main>
        <Toaster position="top" />
      </div>
    </SimProvider>
  );
}
