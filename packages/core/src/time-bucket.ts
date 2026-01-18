const DOWS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

export type TimeBucketDay = (typeof DOWS)[number];
export type TimeBucket = `${TimeBucketDay}_${string}`;

export function defaultBucket(): TimeBucket {
  return "mon_08:30";
}

export function normalizeBucket(input: string): TimeBucket {
  const match = /^([a-z]{3})_(\d{1,2}):(\d{2})$/.exec(input.trim().toLowerCase());
  if (!match) {
    throw new Error("Invalid time bucket format.");
  }

  const day = match[1] as TimeBucketDay;
  if (!DOWS.includes(day)) {
    throw new Error("Invalid time bucket day.");
  }

  const hour = Number.parseInt(match[2], 10);
  const minute = Number.parseInt(match[3], 10);

  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    throw new Error("Invalid time bucket hour.");
  }
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) {
    throw new Error("Invalid time bucket minute.");
  }

  const rounded = Math.round(minute / 15) * 15;
  let nextHour = hour;
  let nextDay = day;
  let nextMinute = rounded;

  if (rounded === 60) {
    nextMinute = 0;
    nextHour += 1;
  }
  if (nextHour === 24) {
    nextHour = 0;
    nextDay = shiftDay(day, 1);
  }

  return `${nextDay}_${pad2(nextHour)}:${pad2(nextMinute)}` as TimeBucket;
}

export function bucketToNextDateTime(
  bucket: TimeBucket,
  now: Date,
  timeZone = "Europe/Paris"
): string {
  const { day, hour, minute } = parseBucket(bucket);
  const nowParts = getZonedParts(now, timeZone);

  let deltaDays = (dayIndex(day) - dayIndex(nowParts.day) + 7) % 7;
  const nowMinutes = nowParts.hour * 60 + nowParts.minute;
  const targetMinutes = hour * 60 + minute;

  if (deltaDays === 0 && nowMinutes >= targetMinutes) {
    deltaDays = 7;
  }

  const baseUtc = new Date(Date.UTC(nowParts.year, nowParts.month - 1, nowParts.dayOfMonth));
  const targetDate = new Date(baseUtc.getTime() + deltaDays * 24 * 60 * 60 * 1000);

  return zonedTimeToUtcIso(
    {
      year: targetDate.getUTCFullYear(),
      month: targetDate.getUTCMonth() + 1,
      day: targetDate.getUTCDate(),
      hour,
      minute
    },
    timeZone
  );
}

function parseBucket(bucket: TimeBucket): { day: TimeBucketDay; hour: number; minute: number } {
  const match = /^([a-z]{3})_(\d{2}):(\d{2})$/.exec(bucket);
  if (!match) {
    throw new Error("Invalid time bucket format.");
  }
  const day = match[1] as TimeBucketDay;
  return {
    day,
    hour: Number.parseInt(match[2], 10),
    minute: Number.parseInt(match[3], 10)
  };
}

function pad2(value: number): string {
  return value.toString().padStart(2, "0");
}

function dayIndex(day: TimeBucketDay): number {
  return DOWS.indexOf(day);
}

function shiftDay(day: TimeBucketDay, delta: number): TimeBucketDay {
  const index = (dayIndex(day) + delta + 7) % 7;
  return DOWS[index];
}

function getZonedParts(
  date: Date,
  timeZone: string
): {
  year: number;
  month: number;
  dayOfMonth: number;
  day: TimeBucketDay;
  hour: number;
  minute: number;
} {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
  const parts = formatter.formatToParts(date);
  const lookup = new Map(parts.map((part) => [part.type, part.value]));

  const dayLabel = (lookup.get("weekday") ?? "").slice(0, 3).toLowerCase();
  const day = DOWS.find((item) => item === dayLabel);
  if (!day) {
    throw new Error("Unsupported weekday.");
  }

  return {
    year: Number.parseInt(lookup.get("year") ?? "0", 10),
    month: Number.parseInt(lookup.get("month") ?? "1", 10),
    dayOfMonth: Number.parseInt(lookup.get("day") ?? "1", 10),
    day,
    hour: Number.parseInt(lookup.get("hour") ?? "0", 10),
    minute: Number.parseInt(lookup.get("minute") ?? "0", 10)
  };
}

function zonedTimeToUtcIso(
  value: { year: number; month: number; day: number; hour: number; minute: number },
  timeZone: string
): string {
  const utcCandidate = new Date(
    Date.UTC(value.year, value.month - 1, value.day, value.hour, value.minute)
  );
  const offsetMinutes = getTimeZoneOffsetMinutes(utcCandidate, timeZone);
  const utcDate = new Date(utcCandidate.getTime() - offsetMinutes * 60 * 1000);
  return utcDate.toISOString();
}

function getTimeZoneOffsetMinutes(date: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "shortOffset"
  });
  const part = formatter
    .formatToParts(date)
    .find((item) => item.type === "timeZoneName")?.value;
  if (!part) return 0;

  const match = /GMT([+-]\d{1,2})(?::(\d{2}))?/.exec(part);
  if (!match) return 0;

  const hours = Number.parseInt(match[1], 10);
  const minutes = match[2] ? Number.parseInt(match[2], 10) : 0;
  const sign = hours < 0 ? -1 : 1;
  return sign * (Math.abs(hours) * 60 + minutes);
}
