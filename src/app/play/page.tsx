import StickPartyGame from "@/components/game/stick-party-game";

export default function PlayPage() {
  return (
    <section className="page-shell">
      <div className="hero-card compact-hero">
        <p className="eyebrow">Play</p>
        <h1>Arena Mode</h1>
        <p>
          One life, infinite pressure. Use movement to survive as long as possible, then decide whether to claim the
          optional rewarded bonus.
        </p>
      </div>
      <StickPartyGame />
    </section>
  );
}
