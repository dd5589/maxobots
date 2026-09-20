import { useEffect, useRef, useState } from 'react';
import { getStartParam, getRawInitData, prepareWebApp } from './api/bridge.js';
import { api } from './api/backend.js';
import Home from './screens/Home.jsx';
import Reason from './screens/Reason.jsx';
import Checklist from './screens/Checklist.jsx';
import Loader from './components/Loader.jsx';
import ErrorState from './components/ErrorState.jsx';

export default function App() {
  const [screen, setScreen] = useState({ name: 'home' });
  const [reason, setReason] = useState(null);
  const [checklist, setChecklist] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [initData, setInitData] = useState('');
  const [initialReasonId, setInitialReasonId] = useState('');

  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) {
      return;
    }

    initialized.current = true;

    try {
      prepareWebApp();

      const raw = getRawInitData();
      const startParam = getStartParam();

      setInitData(raw);
      setInitialReasonId(startParam);

      if (startParam) {
        void openReason(startParam, raw);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    }
  }, []);

  async function openReason(id, authInitData = initData) {
    if (!id) {
      setError('Не указана причина отказа.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [reasonData, checklistData] = await Promise.all([
        api.getReason(id, authInitData),
        api.getChecklist(id, authInitData),
      ]);

      setReason(reasonData);
      setChecklist(checklistData);
      setScreen({ name: 'reason', id });
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }

  function retry() {
    if (initialReasonId) {
      void openReason(initialReasonId, initData);
      return;
    }

    setError(null);
  }

  if (loading) {
    return <Loader label="Готовим разбор…" />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={retry} />;
  }

  if (screen.name === 'reason' && reason && checklist) {
    return (
      <Reason
        reason={reason}
        onOpenChecklist={() => setScreen({ name: 'checklist', id: reason.id })}
        onBack={() => setScreen({ name: 'home' })}
      />
    );
  }

  if (screen.name === 'checklist' && checklist) {
    return (
      <Checklist
        checklist={checklist}
        onBack={() => setScreen({ name: 'reason', id: checklist.reasonId })}
        onClose={() => window.WebApp?.close?.()}
      />
    );
  }

  return <Home onOpenReason={(id) => void openReason(id)} />;
}
