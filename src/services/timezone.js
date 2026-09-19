export function nextLocalMorning(fromMs, timezone, hour = 10) {
  const date = new Date(fromMs);

  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = Object.fromEntries(
    fmt.formatToParts(date).map((part) => [part.type, part.value])
  );

  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);

  const asUTC = Date.UTC(
    year,
    month - 1,
    day,
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );

  const offsetMs = asUTC - fromMs;

  const targetAsUTC = Date.UTC(
    year,
    month - 1,
    day,
    Number(hour),
    0,
    0,
  );

  return targetAsUTC - offsetMs;
}
