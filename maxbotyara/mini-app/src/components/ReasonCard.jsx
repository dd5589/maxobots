export default function ReasonCard({ reason }) {
  return (
    <article className="card">
      <header className="card-header">
        <h2>{reason.title}</h2>
        <span className="badge">Причина</span>
      </header>

      <p className="card-text">{reason.explanation}</p>

      <section className="card-section">
        <h3>Что сделать</h3>
        <ol className="steps">
          {reason.actions.map((a, i) => <li key={i}>{a}</li>)}
        </ol>
      </section>

      <section className="card-section">
        <h3>Куда обращаться</h3>
        <p>{reason.whereToApply ?? 'СФР, «Госуслуги»'}</p>
      </section>

      <footer className="card-footer">
        <small className="muted">Основание: {reason.legalRef}</small>
      </footer>
    </article>
  );
}