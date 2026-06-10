export default function MonetizationPanel() {
  return (
    <section className="support-panel">
      <div>
        <span className="eyebrow">Coming soon</span>
        <h2>Support / Customize</h2>
        <p>Payment system coming later.</p>
      </div>
      <div className="support-actions">
        <button disabled>Add your name as a fighter</button>
        <button disabled>Upload your face as champion</button>
        <button disabled>Sponsor next battle</button>
      </div>
      {/* Future payment and upload integrations belong behind these actions. */}
    </section>
  )
}
