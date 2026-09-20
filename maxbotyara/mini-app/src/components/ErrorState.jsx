export default function ErrorState({ message, onRetry }) {
  return (
    <div className="error">
      <h2>Что-то пошло не так</h2>
      <p>{message}</p>
      {onRetry && <button className="primary" onClick={onRetry}>Повторить</button>}
    </div>
  );
}