import Link from "next/link";
import { Logo } from "@/components/brand/logo";

/** Minimal centred layout for login / password recovery screens. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-bg px-4 py-10">
      <Link href="/" aria-label="Inno Robot home">
        <Logo />
      </Link>
      <div className="w-full max-w-md">{children}</div>
      <p className="text-center text-xs text-subtle">
        Inno Robot — AI-powered university assistant platform
      </p>
    </div>
  );
}
