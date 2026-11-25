/* Pure validation and mapping helpers shared by the Edge Function and Node tests. */
export function isISODate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function metric(value, max, integer = true) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > max) throw new Error('One of the activity metrics is outside its allowed range.');
  if (integer && !Number.isInteger(number)) throw new Error('A whole-number activity metric was expected.');
  return integer ? number : Math.round(number * 10) / 10;
}

export function normalizeHealthPayload(input) {
  if (!input || typeof input !== 'object' || !isISODate(input.day)) throw new Error('A valid local calendar day is required (YYYY-MM-DD).');
  return {
    day: input.day,
    steps: metric(input.steps, 200000),
    exercise_minutes: metric(input.exercise_minutes, 1440, false),
    sleep_minutes: metric(input.sleep_minutes, 1440, false)
  };
}

export function normalizeStravaActivity(activity) {
  if (!activity || activity.id === undefined || activity.id === null) return null;
  const started = activity.start_date_local || activity.start_date || '';
  const day = String(started).slice(0, 10);
  if (!isISODate(day)) return null;
  const duration = metric(activity.moving_time ?? activity.elapsed_time ?? 0, 86400);
  return {
    external_id: String(activity.id),
    day,
    started_at: activity.start_date || started,
    name: String(activity.name || 'Workout').slice(0, 240),
    sport_type: String(activity.sport_type || activity.type || 'Workout').slice(0, 80),
    duration_seconds: duration ?? 0,
    distance_meters: metric(activity.distance, 1000000, false),
    elevation_gain_meters: metric(activity.total_elevation_gain, 100000, false)
  };
}

export function aggregateWorkouts(rows) {
  const totals = new Map();
  for (const row of rows || []) {
    if (!isISODate(row.day)) continue;
    const total = totals.get(row.day) || { day: row.day, workout_count: 0, workout_minutes: 0 };
    total.workout_count += 1;
    total.workout_minutes += Number(row.duration_seconds || 0) / 60;
    totals.set(row.day, total);
  }
  return [...totals.values()].map(row => ({
    ...row,
    workout_minutes: Math.round(row.workout_minutes * 10) / 10
  })).sort((a, b) => a.day.localeCompare(b.day));
}
