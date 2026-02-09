const UPDATE_NOTES = [
  {
    date: "2026-02-09",
    title: "Arena Combat Update",
    details: [
      "Reworked gameplay from pure dodging to combat survival with auto-fire projectiles.",
      "Added enemy classes (runner, zigzag, brute) with HP and different movement behavior.",
      "Added XP orbs, pickups (shield/frenzy/stasis), and mid-run level-up upgrade choices.",
      "Added combo scoring, dash skill with cooldown, and expanded run stats at game over.",
      "Kept rewarded-ad flow policy-safe: optional, completion-only rewards, no close/fail rewards.",
    ],
  },
  {
    date: "2026-02-09",
    title: "MVP Launch Candidate",
    details: [
      "Added original stick-figure survival gameplay loop in /play.",
      "Implemented credits + crystals economy with end-of-match rewards.",
      "Implemented optional rewarded bonus flow with cooldown and daily cap.",
      "Added legal pages, ads.txt placeholder, robots, and sitemap.",
      "Added GA4 event hook plumbing and deploy-ready metadata.",
    ],
  },
  {
    date: "2026-02-09",
    title: "Product Shell",
    details: [
      "Added homepage, about page, and structured navigation.",
      "Added local profile persistence with nickname editing and event log.",
      "Added responsive game UI layers for desktop and mobile." ,
    ],
  },
];

export default function UpdatesPage() {
  return (
    <section className="page-shell prose-shell">
      <article className="content-card wide">
        <p className="eyebrow">Updates</p>
        <h1>Patch Notes</h1>
        {UPDATE_NOTES.map((update) => (
          <section key={`${update.date}-${update.title}`} className="update-block">
            <h2>{update.title}</h2>
            <p className="muted">{update.date}</p>
            <ul>
              {update.details.map((detail) => (
                <li key={detail}>{detail}</li>
              ))}
            </ul>
          </section>
        ))}
      </article>
    </section>
  );
}
