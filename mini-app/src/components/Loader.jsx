export default function Loader({ label = 'Загрузка…' }) {
  return (
    <div className="loader">
      <div className="spinner" />
      <p>{label}</p>
    </div>
  );
}