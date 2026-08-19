import Link from "next/link";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";

const steps = [
  {
    n: "01",
    title: "Complete your profile",
    body: "Provide your gender and phone number. Department and year are auto-extracted from your college email.",
  },
  {
    n: "02",
    title: "Create or join one team",
    body: "Leads create a team and send invites. Everyone else accepts exactly one invite — the portal blocks duplicates.",
  },
  {
    n: "03",
    title: "Submit for validation",
    body: "Once the team has 6 valid members, the lead submits it. The Innovation Studio reviews and locks it.",
  },
];

const rules = [
  "Exactly 6 members per team, including the team lead.",
  "At least one female member per team.",
  "A student can belong to only one team at a time.",
  "Accepting an invite automatically cancels all your other pending invites.",
  "Locked or approved teams can no longer be edited by students.",
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Logo className="text-[22px]" />
        </div>
      </header>

      <section className="bg-navy-gradient">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 md:grid-cols-[1.15fr_1fr] md:py-24">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-gold">
              Smart India Hackathon 2026
            </p>
            <h1 className="mt-4 text-4xl font-extrabold leading-[1.05] tracking-tight text-white md:text-[52px]">
              Form your SIH team.
              <br />
              Once. Correctly.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-[oklch(0.87_0.045_265)]">
              The official team formation portal of the Sri Eshwar Innovation Studio. Every team is
              validated as it is built — no duplicate members, no half-filled submissions, no
              guesswork.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" variant="secondary">
                <Link href="/auth">Sign in with college email</Link>
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-white/15 bg-white/5 p-6 backdrop-blur-sm">
            <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-gold">
              Team validity rules
            </h2>
            <ul className="mt-4 space-y-3">
              {rules.map((r) => (
                <li key={r} className="flex gap-3 text-sm leading-relaxed text-white/90">
                  <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
                  {r}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="mx-auto max-w-6xl px-5 py-16">
        <h2 className="text-2xl font-extrabold tracking-tight text-foreground md:text-3xl">
          Three steps to a valid team
        </h2>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {steps.map((s) => (
            <article
              key={s.n}
              className="shadow-card-soft rounded-xl border border-border bg-card p-6"
            >
              <span className="text-sm font-extrabold tracking-widest text-gold">{s.n}</span>
              <h3 className="mt-3 text-lg font-bold text-foreground">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="border-t border-border bg-secondary">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-8 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
          <Logo className="text-[18px]" />
          <p>Centre for Innovation · Sri Eshwar College of Engineering</p>
        </div>
      </footer>
    </div>
  );
}
