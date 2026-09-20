import ReasonCard from '../components/ReasonCard.jsx';

export default function Reason({ reason, onOpenChecklist, onBack }) {
  return (
    <div className="screen">
      <button className="link" onClick={onBack}>← Все причины</button>
      <ReasonCard reason={reason} />
      <button className="primary" onClick={onOpenChecklist}>
        Открыть чек-лист
      </button>
    </div>
  );
}