export default function AboutPage() {
  return (
    <section className="page-shell prose-shell">
      <article className="content-card wide">
        <p className="eyebrow">About</p>
        <h1>Project Direction</h1>
        <p>
          Stick Arena Party is an original browser game project focused on short-session replayability and optional
          rewarded monetization. The gameplay and assets in this repository are authored for this project and designed
          to avoid direct copying of third-party game content.
        </p>
        <h2>What makes this launch-ready</h2>
        <ul>
          <li>Responsive canvas gameplay for desktop and mobile browsers.</li>
          <li>Two-currency progression system with persistent local save.</li>
          <li>Rewarded bonus flow with completion-only grant logic.</li>
          <li>Daily cap and cooldown constraints for basic abuse prevention.</li>
          <li>Analytics event hooks for GA4 and policy-safe ad placement strategy.</li>
        </ul>
        <h2>What you can add next</h2>
        <ul>
          <li>Firebase Auth + Firestore cloud saves.</li>
          <li>Google Ad Manager rewarded GPT events in the ad flow adapter.</li>
          <li>SEO growth content pages and external traffic strategy.</li>
        </ul>
      </article>
    </section>
  );
}
