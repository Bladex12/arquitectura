interface TimerBlockProps {
  timerRemaining: string;          // formatted "M:SS" or "--:--"
  label?: string;
  activityName?: string;
}

function parseSeconds(timeStr: string): number | null {
  const match = timeStr.match(/^(\d+):(\d{2})$/);
  if (!match) return null;
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
}

export function TimerBlock({
  timerRemaining,
  label = 'Tiempo Restante',
  activityName,
}: TimerBlockProps) {
  const seconds = parseSeconds(timerRemaining);
  const isDanger = seconds !== null && seconds <= 10;
  const isWarn   = seconds !== null && seconds > 10 && seconds <= 30;

  const stateClass = isDanger ? 'timer-danger' : isWarn ? 'timer-warn' : '';

  const sublabel = isDanger
    ? '¡Tiempo casi agotado!'
    : isWarn
    ? 'Tiempo casi agotado...'
    : activityName ?? '';

  return (
    <div className={`timer-block ${stateClass}`}>
      <div className="timer-label">{label}</div>
      <div className="timer-display">{timerRemaining}</div>
      {sublabel && <div className="timer-sublabel">{sublabel}</div>}
    </div>
  );
}
