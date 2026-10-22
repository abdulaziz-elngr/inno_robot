import Link from "next/link";
import { BookOpen, Languages, IdCard, LayoutGrid, Move, ShieldCheck, Sparkles } from "lucide-react";
import { RobotFace } from "@/components/robot/face";
import { Badge } from "@/components/ui/badge";
import { getServerI18n } from "@/lib/i18n/server";
import { getAIStatus } from "@/server/services/ai";
import { getDeviceSnapshots } from "@/server/services/devices";
import { countPublishedKnowledge } from "@/server/services/knowledge";

export const dynamic = "force-dynamic";

/** Landing page. Status values come from real platform state — never hard-coded. */
export default async function LandingPage() {
  const { t } = await getServerI18n();

  const [status, devices, knowledgeCount] = await Promise.all([
    getAIStatus().catch(() => null),
    getDeviceSnapshots().catch(() => []),
    countPublishedKnowledge().catch(() => 0),
  ]);
  const onlineCount = devices.filter((d) => d.status !== "OFFLINE").length;

  const features = [
    { icon: IdCard, title: t("public.landing.featureCardTitle"), body: t("public.landing.featureCardBody") },
    { icon: Languages, title: t("public.landing.featureAssistantTitle"), body: t("public.landing.featureAssistantCardBody") },
    { icon: LayoutGrid, title: t("public.landing.featureCampusTitle"), body: t("public.landing.featureCampusCardBody") },
    { icon: ShieldCheck, title: t("public.landing.featureControlTitle"), body: t("public.landing.featureControlCardBody") },
  ] as const;

  const steps = [
    { icon: IdCard, title: t("public.landing.step1"), body: t("public.landing.step1Body") },
    { icon: Languages, title: t("public.landing.step2"), body: t("public.landing.step2Body") },
    { icon: BookOpen, title: t("public.landing.step3"), body: t("public.landing.step3Body") },
    { icon: Move, title: t("public.landing.step4"), body: t("public.landing.step4Body") },
  ] as const;

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border/70">
        <div className="container-page grid items-center gap-10 py-16 lg:grid-cols-2 lg:py-24">
          <div>
            <Badge variant="info" className="mb-4">
              <Sparkles className="size-3.5" aria-hidden />
              {t("public.landing.badge")}
            </Badge>
            <h1 className="text-4xl font-bold leading-tight text-fg lg:text-5xl">
              {t("public.landing.title")}
              <span className="mt-2 block bg-gradient-to-r from-primary to-violet bg-clip-text text-transparent">{t("public.landing.titleHighlight")}</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">{t("public.landing.subtitle")}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/assistant" className="inline-flex h-12 items-center rounded-xl bg-primary px-6 text-base font-semibold text-white shadow-[0_8px_24px_-12px_rgb(124_58_237_/_0.7)] transition-colors hover:bg-primary-deep">
                {t("public.landing.ctaPrimary")}
              </Link>
              <Link href="/campus" className="inline-flex h-12 items-center rounded-xl border border-border bg-card px-6 text-base font-medium text-fg transition-colors hover:border-primary/50 hover:text-primary">
                {t("public.landing.ctaSecondary")}
              </Link>
            </div>
          </div>
          <div className="flex justify-center">
            <div className="animate-float">
              <RobotFace state="GREETING" size={320} />
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="container-page py-16">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <div key={feature.title} className="surface p-5">
              <feature.icon className="size-7 text-primary" aria-hidden />
              <h3 className="mt-4 font-semibold text-fg">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{feature.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-border/70 bg-card/50">
        <div className="container-page py-16">
          <h2 className="text-center text-2xl font-bold text-fg">{t("public.landing.howItWorks")}</h2>
          <ol className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, index) => (
              <li key={step.title} className="relative">
                <div className="flex size-10 items-center justify-center rounded-full bg-lavender text-primary-deep dark:bg-primary/20 dark:text-violet">
                  <step.icon className="size-5" aria-hidden />
                </div>
                <span className="absolute end-0 top-0 text-5xl font-bold text-border/70" aria-hidden>{index + 1}</span>
                <h3 className="mt-4 font-semibold text-fg">{step.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Live status */}
      <section className="container-page py-16">
        <h2 className="text-center text-2xl font-bold text-fg">{t("public.landing.statusTitle")}</h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          <div className="surface p-5 text-center">
            <p className="text-sm text-muted">{t("public.landing.statusAssistant")}</p>
            <Badge variant={status?.configured ? "success" : "outline"} className="mt-2">
              {status?.configured ? t("public.landing.statusReady") : t("public.landing.statusNotConfigured")}
            </Badge>
          </div>
          <div className="surface p-5 text-center">
            <p className="text-sm text-muted">{t("public.landing.statusRobots")}</p>
            <Badge variant={onlineCount > 0 ? "success" : "outline"} className="mt-2">
              {onlineCount > 0 ? t("public.landing.statusDevicesOnline", { count: onlineCount }) : t("public.landing.statusNotConfigured")}
            </Badge>
          </div>
          <div className="surface p-5 text-center">
            <p className="text-sm text-muted">{t("public.landing.statusKnowledge")}</p>
            <Badge variant={knowledgeCount > 0 ? "success" : "outline"} className="mt-2">
              {knowledgeCount > 0 ? `${knowledgeCount}` : t("public.landing.statusEmpty")}
            </Badge>
          </div>
        </div>
      </section>
    </div>
  );
}
