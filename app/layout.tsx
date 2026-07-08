import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Job Scraper",
  description:
    "Aggregate the latest job postings from your saved company career pages.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen">
          <header className="border-b border-border bg-card/60 backdrop-blur sticky top-0 z-20">
            <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
              <Link href="/" className="flex items-center gap-2 font-semibold">
                <span className="inline-block h-6 w-6 rounded-md bg-accent" />
                <span className="text-lg">Job Scraper</span>
              </Link>
              <nav className="flex items-center gap-1 text-sm">
                <NavLink href="/">Dashboard</NavLink>
                <NavLink href="/sources">Sources</NavLink>
              </nav>
            </div>
          </header>
          <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
        </div>
      </body>
    </html>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="px-3 py-1.5 rounded-md hover:bg-border/60 text-slate-300 hover:text-white transition-colors"
    >
      {children}
    </Link>
  );
}
