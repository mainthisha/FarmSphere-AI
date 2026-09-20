import { Link } from "react-router-dom";
import {
  Bot,
  CloudSun,
  Leaf,
  LineChart,
  Map,
  ScanLine,
  Sprout,
  TrendingUp,
  Wand2,
  Droplets,
  Recycle,
  HandCoins,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const FEATURES = [
  {
    icon: Map,
    title: "Digital Twin Farm",
    text: "An interactive virtual copy of your fields with live crop zones, soil moisture and health scores.",
  },
  {
    icon: Wand2,
    title: "What-If Simulation",
    text: "Move rainfall, fertilizer, irrigation and pest-control sliders and watch yield, profit and risk react instantly.",
  },
  {
    icon: Bot,
    title: "AI Farming Assistant",
    text: "Ask questions in English or Tamil and get the likely issue, a recommendation and practical farming tips.",
  },
  {
    icon: ScanLine,
    title: "Disease Detection",
    text: "Upload a crop photo — AI names the disease, gives a confidence score and a treatment plan.",
  },
  {
    icon: CloudSun,
    title: "Climate Risk Engine",
    text: "Drought, flood and heat-stress prediction with a single Climate Risk Score and clear actions.",
  },
  {
    icon: TrendingUp,
    title: "Profit Prediction",
    text: "Estimate yield, investment, revenue and profit for any crop before a single seed is sown.",
  },
];

const STEPS = [
  { n: "01", title: "Create your farm profile", text: "Tell us your location, land area and preferred crops." },
  { n: "02", title: "We build your digital twin", text: "Your fields become crop zones with live health and moisture data." },
  { n: "03", title: "Simulate before you sow", text: "Test rainfall, fertilizer and irrigation scenarios risk-free." },
  { n: "04", title: "Act on AI guidance", text: "Follow recommendations that raise yield, profit and sustainability." },
];

const SDGS = [
  { icon: Sprout, code: "SDG 2", title: "Zero Hunger", text: "Higher, more predictable yields from the same land." },
  { icon: Droplets, code: "SDG 6", title: "Clean Water", text: "Irrigation guidance that cuts water waste up to 30%." },
  { icon: Recycle, code: "SDG 12", title: "Responsible Production", text: "Right-sized fertilizer use and less runoff." },
  { icon: Leaf, code: "SDG 13", title: "Climate Action", text: "Climate-risk forecasting and carbon-reduction scoring." },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
              <Sprout className="size-5" />
            </span>
            <span className="text-lg font-bold tracking-tight">FarmSphere AI</span>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost">
              <Link to="/auth">Farmer Login</Link>
            </Button>
            <Button asChild>
              <Link to="/simulation">Start Simulation</Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden" style={{ background: "var(--gradient-sky)" }}>
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 lg:grid-cols-2 lg:items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-background/70 px-3 py-1 text-xs font-medium text-primary">
              <LineChart className="size-3.5" /> AI + Digital Twin for Indian farms
            </span>
            <h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
              Farm Digital Twin — AI Powered Virtual Farm
            </h1>
            <p className="mt-5 text-lg text-muted-foreground">
              FarmSphere AI creates a living virtual copy of your farm. Test rainfall, fertilizer, irrigation and crop
              choices in simulation, see the impact on yield, profit, climate risk and sustainability — then act with
              confidence in the real field.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="gap-2">
                <Link to="/simulation">
                  <Wand2 className="size-4" /> Start Simulation
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="gap-2">
                <Link to="/auth">Farmer Login</Link>
              </Button>
            </div>
            <dl className="mt-10 grid grid-cols-3 gap-4 text-center">
              {[
                { k: "+24%", v: "Yield uplift modelled" },
                { k: "-30%", v: "Water waste avoided" },
                { k: "85/100", v: "Avg. Green Farm Score" },
              ].map((s) => (
                <div key={s.k} className="rounded-xl border border-border bg-card p-3">
                  <dt className="text-xl font-bold text-primary">{s.k}</dt>
                  <dd className="text-xs text-muted-foreground">{s.v}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
            <p className="text-sm font-semibold text-muted-foreground">Live twin preview</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {[
                { name: "North Field", crop: "Rice", health: 88 },
                { name: "East Field", crop: "Sugarcane", health: 74 },
                { name: "South Field", crop: "Groundnut", health: 91 },
                { name: "West Field", crop: "Cotton", health: 63 },
              ].map((z) => (
                <div key={z.name} className="rounded-2xl border border-border p-4" style={{ background: "var(--gradient-farm)" }}>
                  <p className="text-sm font-semibold text-primary-foreground">{z.name}</p>
                  <p className="text-xs text-primary-foreground/80">{z.crop}</p>
                  <p className="mt-3 text-2xl font-bold text-primary-foreground">{z.health}%</p>
                  <p className="text-[11px] text-primary-foreground/80">crop health</p>
                </div>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl bg-secondary p-3">
                <p className="text-xs text-muted-foreground">Climate risk</p>
                <p className="text-lg font-bold">72%</p>
              </div>
              <div className="rounded-xl bg-secondary p-3">
                <p className="text-xs text-muted-foreground">Profit</p>
                <p className="text-lg font-bold">₹1.4L</p>
              </div>
              <div className="rounded-xl bg-secondary p-3">
                <p className="text-xs text-muted-foreground">Green score</p>
                <p className="text-lg font-bold">85</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-3xl font-bold tracking-tight">How it works</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <Card key={s.n}>
              <CardHeader className="pb-2">
                <span className="text-sm font-bold text-primary">{s.n}</span>
                <CardTitle className="text-base">{s.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">{s.text}</CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="bg-secondary/50 py-16">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-3xl font-bold tracking-tight">AI features</h2>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Every module runs on the same farm model, so a change in one place updates yield, risk, profit and
            sustainability everywhere.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <Card key={f.title} className="h-full">
                  <CardHeader className="pb-2">
                    <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="size-5" />
                    </span>
                    <CardTitle className="text-base">{f.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">{f.text}</CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-3xl font-bold tracking-tight">SDG sustainability impact</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SDGS.map((s) => {
            const Icon = s.icon;
            return (
              <Card key={s.code}>
                <CardHeader className="pb-2">
                  <span className="grid size-10 place-items-center rounded-xl bg-accent/25 text-accent-foreground">
                    <Icon className="size-5" />
                  </span>
                  <p className="text-xs font-semibold text-primary">{s.code}</p>
                  <CardTitle className="text-base">{s.title}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">{s.text}</CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-5 px-4 py-16 text-center">
          <HandCoins className="size-10 text-primary" />
          <h2 className="text-3xl font-bold tracking-tight">Plan the season before it costs you</h2>
          <p className="max-w-xl text-muted-foreground">
            Join FarmSphere AI and turn every decision — water, nutrition, crop choice — into a tested plan.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link to="/simulation">Start Simulation</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/auth">Farmer Login</Link>
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        FarmSphere AI · Farm Digital Twin for sustainable, profitable farming.
      </footer>
    </div>
  );
}
