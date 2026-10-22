import type { Metadata, Viewport } from "next";
import "@fontsource-variable/ibm-plex-sans";
import "@fontsource/ibm-plex-sans-arabic/arabic-400.css";
import "@fontsource/ibm-plex-sans-arabic/arabic-500.css";
import "@fontsource/ibm-plex-sans-arabic/arabic-600.css";
import "@fontsource/ibm-plex-sans-arabic/arabic-700.css";
import "./globals.css";
import { getLocale, getServerI18n } from "@/lib/i18n/server";
import { dirFor } from "@/lib/i18n/shared";
import { I18nProvider } from "@/lib/i18n/provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { ToastProvider } from "@/components/ui/toast";
import { ConfirmProvider } from "@/components/ui/dialog";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getServerI18n();
  return {
    title: { default: dict.common.appName, template: `%s · ${dict.common.appName}` },
    description: dict.public.landing.subtitle,
    applicationName: dict.common.appName,
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F8F7FC" },
    { media: "(prefers-color-scheme: dark)", color: "#0C0C13" },
  ],
};

/** Applies the stored theme before first paint to avoid a flash of the wrong palette. */
const themeInit = `(function(){try{var t=localStorage.getItem("inno_theme")||"system";var d=t==="dark"||(t==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);if(d)document.documentElement.classList.add("dark");}catch(e){}})();`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const dir = dirFor(locale);

  return (
    <html lang={locale} dir={dir} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body className="min-h-dvh bg-bg text-fg">
        <I18nProvider initialLocale={locale}>
          <ThemeProvider>
            <ToastProvider>
              <ConfirmProvider>{children}</ConfirmProvider>
            </ToastProvider>
          </ThemeProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
