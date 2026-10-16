export function remainingSeconds(closesAt: string | null, now: number): number | null {
  if (!closesAt) {
    return null;
  }
  const end = new Date(closesAt).getTime();
  if (Number.isNaN(end)) {
    return null;
  }
  return Math.max(0, Math.ceil((end - now) / 1000));
}

export function formatClock(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const clock = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  return hours > 0 ? `${hours}:${clock}` : clock;
}
