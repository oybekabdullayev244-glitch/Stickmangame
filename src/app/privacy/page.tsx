export default function PrivacyPage() {
  return (
    <section className="page-shell prose-shell">
      <article className="content-card wide">
        <p className="eyebrow">Legal</p>
        <h1>Privacy Policy</h1>
        <p>Last updated: February 9, 2026</p>

        <h2>1. Data we process</h2>
        <ul>
          <li>Local gameplay profile data (nickname, scores, in-game balances, rewarded claim counters).</li>
          <li>Gameplay interaction telemetry events for analytics when enabled (GA4).</li>
          <li>Device/browser information delivered by hosting and analytics services.</li>
        </ul>

        <h2>2. How data is used</h2>
        <ul>
          <li>To run core gameplay systems and progression.</li>
          <li>To prevent reward abuse with cooldown and daily limits.</li>
          <li>To improve game quality and measure engagement.</li>
        </ul>

        <h2>3. Rewarded ad model</h2>
        <ul>
          <li>Rewarded ads are optional.</li>
          <li>In-game rewards are granted only after ad completion events.</li>
          <li>No cash value and no transferability for in-game rewards.</li>
        </ul>

        <h2>4. Consent and regions</h2>
        <p>
          Where required, consent messaging should be configured before personalized advertising or non-essential
          tracking is enabled.
        </p>

        <h2>5. Contact</h2>
        <p>
          Contact: <a href="mailto:oybekabdullayev244@gmail.com">oybekabdullayev244@gmail.com</a>
        </p>
      </article>
    </section>
  );
}
