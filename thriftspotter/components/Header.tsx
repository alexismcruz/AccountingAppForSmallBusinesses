import Link from "next/link";
import { STATES } from "@/lib/types";

export default function Header() {
  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="text-emerald-700 font-bold text-xl tracking-tight">
          ThriftSpotter
        </Link>
        <nav className="flex gap-6 text-sm font-medium text-gray-600">
          {Object.entries(STATES).map(([slug, name]) => (
            <Link
              key={slug}
              href={`/${slug}`}
              className="hover:text-emerald-700 transition"
            >
              {name}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
