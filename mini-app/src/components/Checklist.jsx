import { useState } from 'react';
import Progress from './Progress.jsx';

export default function Checklist({ checklist, onBack, onClose }) {
  const [items, setItems] = useState(() => ({
    steps: checklist.steps.map((s) => ({ ...s })),
    documents: checklist.documents.map((d) => ({ ...d })),
  }));

  const all = [...items.steps, ...items.documents];
  const done = all.filter((i) => i.done).length;

  function toggle(kind, id) {
    setItems((prev) => ({
      ...prev,
      [kind]: prev[kind].map((i) => (i.id === id ? { ...i, done: !i.done } : i)),
    }));
  }

  return (
    <div className="screen">
      <button className="link" onClick={onBack}>← Назад</button>

      <h1>{checklist.title}</h1>
      <Progress value={done} max={all.length} />

      <section className="card-section">
        <h3>Шаги</h3>
        <ul className="checklist">
          {items.steps.map((s) => (
            <li key={s.id}>
              <label className="check">
                <input type="checkbox" checked={s.done} onChange={() => toggle('steps', s.id)} />
                <span className={s.done ? 'done' : ''}>{s.text}</span>
              </label>
            </li>
          ))}
        </ul>
      </section>

      <section className="card-section">
        <h3>Документы</h3>
        <ul className="checklist">
          {items.documents.map((d) => (
            <li key={d.id}>
              <label className="check">
                <input type="checkbox" checked={d.done} onChange={() => toggle('documents', d.id)} />
                <span className={d.done ? 'done' : ''}>{d.text}</span>
              </label>
            </li>
          ))}
        </ul>
      </section>

      <footer className="screen-footer">
        <small className="muted">Основание: {checklist.legalRef}</small>
        <button className="primary" onClick={onClose}>Готово</button>
      </footer>
    </div>
  );
}