// Mathematical Bold Italic Unicode Map for uppercase A-Z
const BOLD_ITALIC_UPPERCASE: Record<string, string> = {
  A: '𝘼', B: '𝘽', C: '𝘾', D: '𝘿', E: '𝙀', F: '𝙁', G: '𝙂', H: '𝙃', I: '𝙄',
  J: '𝙅', K: '𝙆', L: '𝙇', M: '𝙈', N: '𝙉', O: '𝙊', P: '𝙋', Q: '𝙌', R: '𝙍',
  S: '𝙎', T: '𝙏', U: '𝙐', V: '𝙑', W: '𝙒', X: '𝙓', Y: '𝙔', Z: '𝙕',
};

const BOLD_ITALIC_LOWERCASE: Record<string, string> = {
  a: '𝙖', b: '𝙗', c: '𝙘', d: '𝙙', e: '𝙚', f: '𝙛', g: '𝙜', h: '𝙝', i: '𝙞',
  j: '𝙟', k: '𝙠', l: '𝙡', m: '𝙢', n: '𝙣', o: '𝙤', p: '𝙥', q: '𝙦', r: '𝙧',
  s: '𝙨', t: '𝙩', u: '𝙪', v: '𝙫', w: '𝙬', x: '𝙭', y: '𝙮', z: '𝙯',
};

/**
 * Converts standard text to Mathematical Bold Italic unicode characters.
 * Numbers and hyphens remain standard as per specification (e.g. "03", "02-03", "12-23").
 */
export function toMathBoldItalic(text: string): string {
  let result = '';
  for (const char of text) {
    if (BOLD_ITALIC_UPPERCASE[char]) {
      result += BOLD_ITALIC_UPPERCASE[char];
    } else if (BOLD_ITALIC_LOWERCASE[char]) {
      result += BOLD_ITALIC_LOWERCASE[char];
    } else {
      result += char;
    }
  }
  return result;
}

/**
 * Formats Episode/Movie Button Text strictly according to the Master Project Specification:
 * - Single Episode: "◱ 𝙀𝙋𝙄𝙎𝙊𝘿𝙀 03 𝘼𝘿𝘿𝙀𝘿 ◰"
 * - Multiple Episodes: "◱ 𝙀𝙋𝙄𝙎𝙊𝘿𝙀 02-03 𝘼𝘿𝘿𝙀𝘿 ◰"
 * - Another Range: "◱ 𝙀𝙋𝙄𝙎𝙊𝘿𝙀 12-23 𝘼𝘿𝘿𝙀𝘿 ◰"
 * - Movie: "◱ 𝙁𝙐𝙇𝙇 𝙈𝙊𝙑𝙄𝙀 𝘼𝘿𝘿𝙀𝘿 ◰"
 */
export function formatEpisodeButtonText(
  postType: 'single_episode' | 'episode_range' | 'movie' | string,
  episodeInput?: string
): string {
  if (postType === 'movie' || episodeInput === 'Full Movie' || episodeInput === 'movie') {
    return '◱ 𝙁𝙐𝙇𝙇 𝙈𝙊𝙑𝙄𝙀 𝘼𝘿𝘿𝙀𝘿 ◰';
  }

  // Clean raw input: strip any "range_", "episode_", "ep_", "episodes_" prefix
  let formattedNum = (episodeInput || '01').trim();
  formattedNum = formattedNum.replace(/^(range_|episode_|ep_|episodes_)/i, '').trim();

  // If single number < 10 without leading zero, format to 2 digits e.g. "3" -> "03", "10" -> "10"
  if (/^\d+$/.test(formattedNum)) {
    if (formattedNum.length === 1) {
      formattedNum = '0' + formattedNum;
    }
  } else if (/^(\d+)\s*[-–—&]\s*(\d+)$/.test(formattedNum)) {
    const match = formattedNum.match(/^(\d+)\s*[-–—&]\s*(\d+)$/);
    if (match) {
      const p1 = match[1].length === 1 ? '0' + match[1] : match[1];
      const p2 = match[2].length === 1 ? '0' + match[2] : match[2];
      formattedNum = `${p1}-${p2}`;
    }
  }

  return `◱ 𝙀𝙋𝙄𝙎𝙊𝘿𝙀 ${formattedNum} 𝘼𝘿𝘿𝙀𝘿 ◰`;
}

/**
 * Parse time inputs supporting relative (1m, 10m, 30m, 2h, 10h, 1d, 10d) or absolute date time (YYYY-MM-DD HH:MM in Asia/Kolkata).
 */
export function parseScheduleInput(input: string, timezone = 'Asia/Kolkata'): { date: Date; displayIST: string } {
  const trimmed = input.trim();
  const now = new Date();

  // Check relative syntax: e.g. "1m", "10m", "30m", "2h", "10h", "1d", "10d"
  const relativeMatch = trimmed.match(/^(\d+)\s*(m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days)$/i);
  if (relativeMatch) {
    const value = parseInt(relativeMatch[1], 10);
    const unit = relativeMatch[2].toLowerCase();
    let targetMs = now.getTime();

    if (unit.startsWith('m')) {
      targetMs += value * 60 * 1000;
    } else if (unit.startsWith('h')) {
      targetMs += value * 60 * 60 * 1000;
    } else if (unit.startsWith('d')) {
      targetMs += value * 24 * 60 * 60 * 1000;
    }

    const targetDate = new Date(targetMs);
    return {
      date: targetDate,
      displayIST: formatToISTDisplay(targetDate),
    };
  }

  // Check specific date/time input like "2026-08-15 21:00" or "2026-08-15T21:00"
  // If only time given e.g. "21:00" or "22:30", assume today/tomorrow in Asia/Kolkata
  if (/^\d{1,2}:\d{2}$/.test(trimmed)) {
    const [hours, minutes] = trimmed.split(':').map((n) => parseInt(n, 10));
    // Calculate IST offset (+5:30 = 330 minutes)
    const istOffsetMs = (5 * 60 + 30) * 60 * 1000;
    const nowIST = new Date(now.getTime() + istOffsetMs);
    
    // Set time in IST
    const targetIST = new Date(nowIST);
    targetIST.setUTCHours(hours, minutes, 0, 0);
    
    // If time is earlier today in IST, schedule for tomorrow
    if (targetIST.getTime() <= nowIST.getTime()) {
      targetIST.setUTCDate(targetIST.getUTCDate() + 1);
    }
    
    const targetDate = new Date(targetIST.getTime() - istOffsetMs);
    return {
      date: targetDate,
      displayIST: formatToISTDisplay(targetDate),
    };
  }

  // Date and Time: "2026-08-15 21:00"
  const dateMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})[\sT](\d{1,2}):(\d{2})$/);
  if (dateMatch) {
    const year = parseInt(dateMatch[1], 10);
    const month = parseInt(dateMatch[2], 10) - 1;
    const day = parseInt(dateMatch[3], 10);
    const hours = parseInt(dateMatch[4], 10);
    const minutes = parseInt(dateMatch[5], 10);

    // Treat as Asia/Kolkata (UTC +5:30)
    const utcDate = new Date(Date.UTC(year, month, day, hours - 5, minutes - 30, 0, 0));
    return {
      date: utcDate,
      displayIST: formatToISTDisplay(utcDate),
    };
  }

  // Fallback try standard date parse
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    return {
      date: parsed,
      displayIST: formatToISTDisplay(parsed),
    };
  }

  throw new Error(`Invalid schedule time format. Supported: "10m", "2h", "1d", "21:00", or "2026-08-15 21:00" (Asia/Kolkata)`);
}

/**
 * Format any Date into readable IST string: e.g. "15 Aug 2026 · 21:00 IST"
 */
export function formatToISTDisplay(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return 'Invalid Date';

  const options: Intl.DateTimeFormatOptions = {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  };

  const formatter = new Intl.DateTimeFormat('en-IN', options);
  const parts = formatter.formatToParts(d);
  
  const day = parts.find((p) => p.type === 'day')?.value || '';
  const month = parts.find((p) => p.type === 'month')?.value || '';
  const year = parts.find((p) => p.type === 'year')?.value || '';
  const hour = parts.find((p) => p.type === 'hour')?.value || '';
  const minute = parts.find((p) => p.type === 'minute')?.value || '';

  return `${day} ${month} ${year} · ${hour}:${minute} IST`;
}

export const STUDIO_CREDIT = 'Developed by KYAMI Studios (Erwin Smith)';
