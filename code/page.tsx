import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, Minus } from "lucide-react";
import CopyCommand from "./CopyCommand";
import HeroDemo from "./HeroDemo";
import InstallGlow from "./InstallGlow";

export const metadata: Metadata = {
  title: "Share localhost. Get live feedback, instantly. | Stoa",
  description:
    "ShareLocalhost gives you a public URL for your dev server in seconds. Viewers leave a voice memo right on the page. Audio and transcript stream back to your terminal.",
  openGraph: {
    title: "Share localhost. Get live feedback, instantly. | Stoa",
    description:
      "Public URL for your dev server in seconds. Viewers leave a voice memo right on the page. Audio and transcript stream back to your terminal.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Share localhost. Get live feedback, instantly. | Stoa",
    description:
      "Public URL for your dev server in seconds. Viewers leave a voice memo right on the page. Audio and transcript stream back to your terminal.",
  },
  alternates: { canonical: "/sharelocalhost" },
};

type Cell = { kind: "yes" } | { kind: "no" } | { kind: "text"; text: string };

const compareRows: {
  label: string;
  stoa: Cell;
  ngrok: Cell;
  cloudflare: Cell;
}[] = [
  {
    label: "Free account to share",
    stoa: { kind: "yes" },
    ngrok: { kind: "yes" },
    cloudflare: { kind: "no" },
  },
  {
    label: "Voice memo capture",
    stoa: { kind: "yes" },
    ngrok: { kind: "no" },
    cloudflare: { kind: "no" },
  },
  {
    label: "Auto-transcription",
    stoa: { kind: "yes" },
    ngrok: { kind: "no" },
    cloudflare: { kind: "no" },
  },
  {
    label: "Agent-ready transcript file",
    stoa: { kind: "yes" },
    ngrok: { kind: "no" },
    cloudflare: { kind: "no" },
  },
  {
    label: "Feedback in your terminal",
    stoa: { kind: "yes" },
    ngrok: { kind: "no" },
    cloudflare: { kind: "no" },
  },
  {
    label: "WebSocket / HMR",
    stoa: { kind: "yes" },
    ngrok: { kind: "yes" },
    cloudflare: { kind: "yes" },
  },
];

function CompareCell({ cell }: { cell: Cell }) {
  if (cell.kind === "yes") {
    return (
      <Check
        size={16}
        className="text-[var(--accent)] mx-auto"
        aria-label="Yes"
      />
    );
  }
  if (cell.kind === "no") {
    return (
      <Minus size={16} className="text-[#c4bfb9] mx-auto" aria-label="No" />
    );
  }
  return (
    <span className="text-sm text-[var(--text-secondary)]">{cell.text}</span>
  );
}

export default function ShareLocalhostPage() {
  return (
    <div className="bg-elevated">
      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="relative pt-20 md:pt-28 pb-24 md:pb-32 overflow-hidden">
        <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
          {/* Soft backdrop behind the hero copy — gives the headline a
              visual halo so the demo's flight trail (which renders at z-20
              and overflows into the headline area) fades out behind the
              text without disappearing entirely. */}
          <div
            aria-hidden
            className="absolute pointer-events-none bg-elevated"
            style={{
              zIndex: 25,
              left: "50%",
              top: "-32px",
              translate: "-50% 0",
              width: "min(1100px, 96vw)",
              height: "460px",
              opacity: 0.8,
              mask: "radial-gradient(ellipse 60% 55% at center, black 32%, transparent 78%)",
              WebkitMask:
                "radial-gradient(ellipse 60% 55% at center, black 32%, transparent 78%)",
            }}
          />

          {/* Text content sits above the backdrop. */}
          <div className="relative" style={{ zIndex: 30 }}>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-serif font-bold text-foreground leading-[1.05] tracking-tight mb-6">
              Share localhost.{" "}
              <span className="text-[var(--accent)]">
                Get live feedback, instantly.
              </span>
            </h1>
            <p className="text-base md:text-lg font-sans text-[#6b6560] leading-relaxed max-w-2xl mx-auto text-balance">
              One command turns localhost into a public URL.
              <br className="hidden md:inline" /> Viewers leave a{" "}
              <span className="text-foreground font-medium">voice memo</span>{" "}
              right on the page.
              <br className="hidden md:inline" /> You get the transcript, ready
              for your{" "}
              <span className="text-foreground font-medium">agent</span>.
            </p>
          </div>

          {/* Animated demo: localhost → public URL → feedback */}
          <div className="mt-14 md:mt-16">
            <HeroDemo />
          </div>

          {/* Two-step quickstart: install, then run.
              Wrapped in a relative container so the InstallGlow can sit
              behind the steps and light them up when the hero flight
              animation lands here. */}
          <div className="relative mt-16 md:mt-20">
            <InstallGlow />
            <div className="relative max-w-xl mx-auto">
              {/* Glassy card wrapping both steps. The translucent fill +
                  backdrop-blur + saturate amplifies the indigo glow
                  rendered behind it, so when InstallGlow ignites the
                  whole card reads as "lit up".
                  The data-flight-target attribute is read by HeroDemo to
                  trim the plane's flight so it lands exactly at the
                  card's top edge, regardless of viewport size. */}
              <div
                data-flight-target
                className="relative rounded-2xl border border-white/60 bg-white/55 backdrop-blur-md backdrop-saturate-150 p-5 sm:p-7 space-y-6 text-left shadow-[0_10px_36px_-14px_rgba(42,37,32,0.10),inset_0_1px_0_rgba(255,255,255,0.7)]"
              >
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <span className="w-7 h-7 rounded-full bg-[var(--accent-subtle)] border border-[var(--accent)]/35 flex items-center justify-center text-[13px] font-semibold text-[var(--accent)] tabular-nums shrink-0">
                      1
                    </span>
                    <span className="text-sm font-sans font-medium text-foreground">
                      Install the CLI{" "}
                      <span className="font-normal text-[var(--text-secondary)]">
                        (
                        <a
                          href="https://docs.withstoa.com/reference/cli#installation"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-[var(--accent)] transition-colors underline underline-offset-2 decoration-dotted cursor-pointer"
                        >
                          other ways to install
                        </a>
                        )
                      </span>
                    </span>
                  </div>
                  <CopyCommand
                    lines={[
                      "brew tap specstoryai/tap",
                      "brew update",
                      "brew install stoa",
                    ]}
                  />
                </div>

                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <span className="w-7 h-7 rounded-full bg-[var(--accent-subtle)] border border-[var(--accent)]/35 flex items-center justify-center text-[13px] font-semibold text-[var(--accent)] tabular-nums shrink-0">
                      2
                    </span>
                    <span className="text-sm font-sans font-medium text-foreground">
                      Share your dev server{" "}
                      <span className="font-normal text-[var(--text-secondary)]">
                        (
                        <a
                          href="https://docs.withstoa.com/sharelocalhost"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-[var(--accent)] transition-colors underline underline-offset-2 decoration-dotted cursor-pointer"
                        >
                          read the docs
                        </a>
                        )
                      </span>
                    </span>
                  </div>
                  <div className="rounded-md border border-border-strong bg-foreground text-background/90 shadow-[0_20px_60px_rgba(42,37,32,0.18)] overflow-hidden">
                    <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-white/10">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
                      <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
                      <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
                    </div>
                    <div className="px-5 py-4 font-mono text-sm leading-relaxed">
                      <div>
                        <span className="text-white/40">$ </span>
                        <span className="text-white">
                          stoa sharelocalhost 3000
                        </span>
                      </div>
                      <div className="mt-2 text-white/60">
                        <span className="text-[#a5b4fc]">→</span>{" "}
                        https://abc123.share.withstoa.com
                      </div>
                      <div className="text-white/40 text-xs mt-1">
                        Listening for feedback. Press Ctrl+C to stop.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Pain ─────────────────────────────────────────────────── */}
      <section className="pt-20 md:pt-28 pb-20 md:pb-28 bg-background border-t border-border-muted">
        <div className="max-w-2xl mx-auto px-6">
          <p className="text-xs font-sans font-medium text-[var(--accent)] uppercase tracking-widest mb-5 text-center">
            The pain
          </p>
          <h2 className="text-3xl md:text-4xl font-serif font-bold text-foreground tracking-tight leading-[1.15] mb-8 text-center">
            Sharing your app is easy.
            <br />
            Hearing real feedback is harder.
          </h2>
          <div className="space-y-6 text-lg font-sans text-[#6b6560] leading-relaxed">
            <p>
              You built something worth showing. A demo, a half-finished
              feature, a Saturday side project. You want eyes on it now, on
              someone else&apos;s machine, without spinning up staging or
              shipping a PR preview just for two minutes of feedback.
            </p>
            <p>
              Tunneling localhost is the easy part. Capturing what they actually
              thought is not. They open the link, mutter something at the
              screen, close the tab, and whatever crossed their mind goes with
              it. You&apos;re left guessing from a screenshot and a &ldquo;looks
              great!&rdquo;
            </p>
          </div>
        </div>
      </section>

      {/* ── Solution ─────────────────────────────────────────────── */}
      <section className="pt-20 md:pt-28 pb-20 md:pb-28">
        <div className="max-w-2xl mx-auto px-6">
          <p className="text-xs font-sans font-medium text-[var(--accent)] uppercase tracking-widest mb-5 text-center">
            The fix
          </p>
          <h2 className="text-3xl sm:text-3xl md:text-4xl font-serif font-bold text-foreground tracking-tight leading-[1.15] mb-12 text-center text-balance">
            Hand over a URL.
            <br className="sm:hidden" />{" "}
            Get a voice memo.
          </h2>

          <ol className="space-y-10">
            <li className="flex gap-5">
              <div className="shrink-0 w-8 h-8 rounded-full bg-[var(--accent-subtle)] border border-[var(--accent)]/35 flex items-center justify-center text-sm font-semibold text-[var(--accent)] tabular-nums">
                1
              </div>
              <div>
                <h3 className="text-lg font-serif font-bold text-foreground mb-2">
                  Run one command.
                </h3>
                <p className="text-base font-sans text-[#6b6560] leading-relaxed">
                  <code className="font-mono text-sm bg-elevated border border-border-muted px-1.5 py-0.5 rounded">
                    stoa sharelocalhost
                  </code>{" "}
                  lists your running dev servers. Pick one. You get a public URL
                  back, live for one hour.
                </p>
              </div>
            </li>

            <li className="flex gap-5">
              <div className="shrink-0 w-8 h-8 rounded-full bg-[var(--accent-subtle)] border border-[var(--accent)]/35 flex items-center justify-center text-sm font-semibold text-[var(--accent)] tabular-nums">
                2
              </div>
              <div>
                <h3 className="text-lg font-serif font-bold text-foreground mb-2">
                  They open the link.
                </h3>
                <p className="text-base font-sans text-[#6b6560] leading-relaxed">
                  No login. No install. A small button sits in the corner of
                  every page. They click, record a voice memo, and send.
                </p>
              </div>
            </li>

            <li className="flex gap-5">
              <div className="shrink-0 w-8 h-8 rounded-full bg-[var(--accent-subtle)] border border-[var(--accent)]/35 flex items-center justify-center text-sm font-semibold text-[var(--accent)] tabular-nums">
                3
              </div>
              <div>
                <h3 className="text-lg font-serif font-bold text-foreground mb-2">
                  Their words land as agent-ready text.
                </h3>
                <p className="text-base font-sans text-[#6b6560] leading-relaxed">
                  We transcribe the audio. It lands in your terminal and drops
                  into{" "}
                  <code className="font-mono text-sm bg-elevated border border-border-muted px-1.5 py-0.5 rounded">
                    ~/.stoa/feedback/
                  </code>{" "}
                  next to the original recording. Pipe it straight to Claude
                  Code, Cursor, Codex, or whatever&apos;s building the next
                  change.
                </p>
              </div>
            </li>
          </ol>
        </div>
      </section>

      {/* ── Comparison ───────────────────────────────────────────── */}
      <section className="pt-20 md:pt-28 pb-20 md:pb-28 bg-background border-t border-border-muted">
        <div className="max-w-2xl mx-auto px-6">
          <p className="text-xs font-sans font-medium text-[var(--accent)] uppercase tracking-widest mb-5 text-center">
            More than a tunnel
          </p>
          <h2 className="text-3xl md:text-4xl font-serif font-bold text-foreground tracking-tight leading-[1.15] mb-12 text-center">
            A public URL is the start.
            <br />
            The feedback loop is the point.
          </h2>

          <div className="border-t border-border-muted">
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 sm:gap-x-6 md:gap-x-10 py-4 border-b border-border-muted text-[10px] sm:text-xs font-sans font-medium uppercase tracking-widest text-[var(--text-muted)]">
              <div></div>
              <div className="text-center text-[var(--accent)] w-14 sm:w-24 md:w-28">
                <span className="sm:hidden">Stoa</span>
                <span className="hidden sm:inline">ShareLocalhost</span>
              </div>
              <div className="text-center w-12 sm:w-16 md:w-20">ngrok</div>
              <div className="text-center w-12 sm:w-20 md:w-24">
                <span className="sm:hidden">CF</span>
                <span className="hidden sm:inline">Cloudflare</span>
              </div>
            </div>
            {compareRows.map((row) => (
              <div
                key={row.label}
                className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 sm:gap-x-6 md:gap-x-10 py-4 border-b border-border-muted items-center"
              >
                <div className="text-[13px] sm:text-sm font-sans text-foreground">
                  {row.label}
                </div>
                <div className="w-14 sm:w-24 md:w-28">
                  <CompareCell cell={row.stoa} />
                </div>
                <div className="w-12 sm:w-16 md:w-20">
                  <CompareCell cell={row.ngrok} />
                </div>
                <div className="w-12 sm:w-20 md:w-24">
                  <CompareCell cell={row.cloudflare} />
                </div>
              </div>
            ))}
          </div>

          <div id="install" className="mt-12 max-w-md mx-auto scroll-mt-24">
            <p className="text-sm font-sans font-medium text-foreground text-center mb-3">
              Install the Stoa CLI
            </p>
            <CopyCommand
              lines={[
                "brew tap specstoryai/tap",
                "brew update",
                "brew install stoa",
              ]}
            />
            <div className="mt-2 text-center">
              <a
                href="https://docs.withstoa.com/reference/cli#installation"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-sans text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors cursor-pointer"
              >
                Other ways to install →
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────── */}
      <section className="pt-20 md:pt-28 pb-24 md:pb-32">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-px bg-border-muted rounded-md overflow-hidden border border-border-muted">
            {/* Left: Ship the demo */}
            <div className="bg-background p-8 md:p-10 flex flex-col">
              <p className="text-xs font-sans font-medium text-[var(--accent)] uppercase tracking-widest mb-4">
                For you, today
              </p>
              <h2 className="text-2xl md:text-3xl font-serif font-bold text-foreground tracking-tight leading-[1.2] mb-4">
                Ship the demo.
                <br />
                Hear the reactions.
              </h2>
              <p className="text-base font-sans text-[#6b6560] leading-relaxed mb-8 flex-1">
                One command. Nothing to install for your viewers. The next time
                you share something you built, you&apos;ll have their words
                saved next to the URL you sent them.
              </p>
              <div>
                <Link
                  href="https://docs.withstoa.com/sharelocalhost"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 bg-cta text-background px-7 py-3 text-sm font-sans font-medium rounded-sm hover:bg-cta-hover transition-colors cursor-pointer"
                >
                  Read the docs
                  <ArrowRight size={16} />
                </Link>
              </div>
            </div>

            {/* Right: The bigger picture */}
            <div className="bg-elevated p-8 md:p-10 flex flex-col">
              <p className="text-xs font-sans font-medium text-[var(--accent)] uppercase tracking-widest mb-4">
                The bigger picture
              </p>
              <h2 className="text-2xl md:text-3xl font-serif font-bold text-foreground tracking-tight leading-[1.2] mb-4">
                The smallest piece of a much bigger loop.
              </h2>
              <p className="text-base font-sans text-[#6b6560] leading-relaxed mb-8 flex-1">
                Stoa runs the same loop across your whole team. Every meeting,
                every agent run, every change in the codebase, captured as it
                happens and kept next to the work. The full one is multiplayer
                AI for teams.
              </p>
              <div>
                <Link
                  href="/"
                  className="inline-flex items-center justify-center gap-2 border border-border-strong text-foreground px-7 py-3 text-sm font-sans font-medium rounded-sm hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors cursor-pointer"
                >
                  See Stoa for teams
                  <ArrowRight size={16} />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
