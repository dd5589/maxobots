import { useState } from 'react';

const REASONS = [
  { id: 'smv_error', title: 'Ошибка СМЭВ' },
  { id: 'income_calc', title: 'Расчёт дохода' },
  { id: 'property', title: 'Имущество' },
  { id: 'zero_income', title: 'Нулевой доход' },
  { id: 'documents', title: 'Документы' },
  { id: 'citizenship', title: 'Гражданство' },
  { id: 'child_age', title: 'Возраст ребёнка' },
  { id: 'other', title: 'Иная причина' },
];

export default function Home({ onOpenReason }) {
  const [query, setQuery] = useState('');
  const filtered = REASONS.filter((r) =>
    r.title.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="screen">
      <h1>Разбор отказа</h1>
      <p className="muted">Выберите причину, которую хотите разобрать подробнее.</p>

      <input
        className="input"
        type="search"
        placeholder="Поиск причины…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <ul className="list">
        {filtered.map((r) => (
          <li key={r.id}>
            <button className="list-item" onClick={() => onOpenReason(r.id)}>
              <span>{r.title}</span>
              <span className="chevron">›</span>
            </button>
          </li>
        ))}
        {filtered.length === 0 && <li className="muted">Ничего не найдено</li>}
      </ul>
    </div>
  );
}