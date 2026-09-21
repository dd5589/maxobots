import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/backend.js';
import Loader from '../components/Loader.jsx';
import ErrorState from '../components/ErrorState.jsx';

export default function Home() {
  const [data, setData] = useState(null);
  const [categoryId, setCategoryId] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    api.getScenarios()
      .then((value) => {
        if (active) setData(value);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      active = false;
    };
  }, []);

  const category = useMemo(
    () => data?.categories?.find((item) => item.id === categoryId) ?? null,
    [data, categoryId]
  );

  const scenarios = useMemo(
    () => data?.scenarios?.filter((item) => item.categoryId === categoryId) ?? [],
    [data, categoryId]
  );

  if (error) {
    return <ErrorState message={error} onRetry={() => window.location.reload()} />;
  }

  if (!data) {
    return <Loader label="Загружаем сценарии…" />;
  }

  if (category) {
    return (
      <div className="screen">
        <button className="link" onClick={() => setCategoryId(null)}>
          ← Все категории
        </button>

        <h1>{category.title}</h1>
        <p className="muted">{category.description}</p>

        <div className="section-title">Сценарии</div>
        <ul className="scenario-grid">
          {scenarios.map((scenario) => (
            <li key={scenario.id}>
              <button
                className="scenario-card"
                onClick={() => window.WebApp?.close?.()}
              >
                <strong>{scenario.title}</strong>
                <span>{scenario.description}</span>
              </button>
            </li>
          ))}
        </ul>

        <p className="hint">
          Выбор и прохождение сценария выполняются в чате кнопками под сообщениями.
        </p>
      </div>
    );
  }

  return (
    <div className="screen">
      <h1>Выберите категорию</h1>
      <p className="muted">
        Затем выберите сценарий. Вопросы с вариантами ответа проходят через кнопки.
      </p>

      <div className="category-grid">
        {data.categories.map((item) => (
          <button
            key={item.id}
            className="category-card"
            onClick={() => setCategoryId(item.id)}
          >
            <strong>{item.title}</strong>
            <span>{item.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
