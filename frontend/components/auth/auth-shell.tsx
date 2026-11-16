import { ArrowUpRight, BarChart3, MessageSquare, Workflow } from "lucide-react";
import { Logo } from "@/components/common/logo";

const features = [
  {
    icon: MessageSquare,
    title: "One shared inbox",
    description: "Email, WhatsApp and SMS conversations side by side."
  },
  {
    icon: Workflow,
    title: "Visual automation",
    description: "Drag, drop and ship journeys that adapt in real time."
  },
  {
    icon: BarChart3,
    title: "Revenue-grade analytics",
    description: "Every open, click and conversion attributed clearly."
  }
];

const chartValues = [38, 52, 44, 68, 61, 84, 76, 96, 88, 108, 102, 124];

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.08fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-[#090514] p-10 text-white lg:flex lg:flex-col xl:p-14">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-24 -top-24 size-[420px] rounded-full bg-violet-600/30 blur-[110px]" />
          <div className="absolute -right-20 top-1/4 size-[380px] rounded-full bg-fuchsia-600/25 blur-[110px]" />
          <div className="absolute -bottom-32 left-1/4 size-[420px] rounded-full bg-teal-500/20 blur-[120px]" />
          <div className="absolute inset-0 bg-grid-fade bg-[length:44px_44px] opacity-40" />
        </div>

        <div className="relative z-10">
          <Logo onDark href="/login" />
        </div>

        <div className="relative z-10 mt-auto max-w-xl pb-8">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/70 backdrop-blur">
            <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />
            The omnichannel growth OS
          </span>
          <h1 className="mt-5 font-display text-4xl font-semibold leading-[1.08] tracking-tight xl:text-5xl">
            Every channel.
            <br />
            <span className="gradient-text">One beautiful flow.</span>
          </h1>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-white/55">
            Campaigns, automation, conversations and analytics unified in a workspace your whole team will love opening
            every morning.
          </p>

          <div className="mt-9 space-y-4">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div key={feature.title} className="flex items-start gap-3.5">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.14] to-white/[0.04] text-violet-200 shadow-inner-glow">
                    <Icon className="size-[18px]" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-white">{feature.title}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-white/45">{feature.description}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-10 rounded-3xl border border-white/10 bg-white/[0.05] p-5 shadow-glow backdrop-blur-2xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">Campaign performance</p>
                <p className="mt-1 font-display text-2xl font-semibold text-white">
                  98.4% <span className="text-xs font-medium text-emerald-300">delivered</span>
                </p>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/15 px-2 py-1 text-[10px] font-bold text-emerald-300">
                <ArrowUpRight className="size-3" /> 12.6%
              </span>
            </div>
            <div className="mt-4 flex h-24 items-end gap-1.5">
              {chartValues.map((value, index) => (
                <div
                  key={index}
                  className="flex-1 rounded-t-md bg-gradient-to-t from-violet-600/40 via-fuchsia-500/60 to-amber-300/80 transition-all duration-500"
                  style={{ height: `${(value / 124) * 100}%`, opacity: 0.55 + (index / chartValues.length) * 0.45 }}
                />
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between text-[10px] font-medium uppercase tracking-wider text-white/30">
              <span>Mon</span>
              <span>Wed</span>
              <span>Fri</span>
              <span>Sun</span>
            </div>
          </div>
        </div>

        <div className="relative z-10 mt-6 flex items-center gap-2 text-xs text-white/35">
          <span className="size-1.5 rounded-full bg-emerald-400" />
          Built for modern growth teams
        </div>
      </aside>

      <main className="relative flex min-h-screen flex-col overflow-hidden">
        <div className="pointer-events-none absolute inset-0 aurora-layer opacity-80" />
        <div className="relative flex flex-1 items-center justify-center px-5 py-10 sm:px-8">
          <div className="w-full max-w-[430px]">
            <div className="mb-8 lg:hidden">
              <Logo href="/login" />
            </div>
            {children}
          </div>
        </div>
        <footer className="relative px-6 pb-6 text-center text-[11px] text-muted-foreground">
          © {new Date().getFullYear()} comGpt. Privacy-first by design. All times shown in your workspace timezone.
        </footer>
      </main>
    </div>
  );
}
