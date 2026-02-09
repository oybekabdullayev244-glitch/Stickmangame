import Link from "next/link";

const FEATURES = [
  {
    title: "Original Arena Gameplay",
    text: "Fast dodge-and-survive loop with stick-figure style visuals, tuned for short mobile or desktop sessions.",
  },
  {
    title: "Dual Currency Economy",
    text: "Every match grants credits and crystals. Better runs pay more, but rewards stay balanced for long-term progression.",
  },
  {
    title: "Optional Rewarded Bonus",
    text: "Players can choose to watch a rewarded ad after defeat. Rewards are granted only on full completion.",
  },
  {
    title: "Deploy-Ready Foundation",
    text: "Built in Next.js with analytics hooks, legal pages, robots/sitemap, and clean structure for future ad integration.",
  },
];

export default function HomePage() {
  return (
    <section className="page-shell">
      <div className="hero-card">
        <p className="eyebrow">Web Game MVP</p>
        <h1>Stick Arena Party</h1>
        <p>
          Survive hunting stick foes, push your score, and stack up game money. Rewarded bonuses are optional and
          completion-based.
        </p>
        <div className="inline-actions">
          <Link href="/play" className="primary-btn anchor">
            Play Now
          </Link>
          <Link href="/about" className="ghost-btn anchor">
            About This Project
          </Link>
        </div>
      </div>

      <div className="card-grid">
        {FEATURES.map((feature) => (
          <article key={feature.title} className="content-card">
            <h2>{feature.title}</h2>
            <p>{feature.text}</p>
          </article>
        ))}
      </div>

      <article className="content-card wide">
        <h2>Current Build Scope</h2>
        <p>
          This deployment-ready build includes gameplay, rewards, anti-abuse cooldown/cap rules, legal placeholders,
          analytics event hooks, and production-safe routing. Firebase auth, Ad Manager rewarded units, and final SEO
          growth pages can be layered in next.
        </p>
      </article>
    </section>
  );
}
