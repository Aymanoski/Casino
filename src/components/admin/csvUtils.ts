import { z } from 'zod';
import { PlayerStatusSchema, type PlayerStatus } from '@/lib/schemas';

/**
 * RFC-4180 compliant CSV parser supporting quoted fields, embedded commas,
 * escaped quotes (""), and CRLF/LF newlines.
 */
export function parseCsvText(rawText: string): string[][] {
  const text = rawText.replace(/^\uFEFF/, '').trim();
  if (!text) return [];

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field.trim());
      field = '';
    } else if (ch === '\r' && next === '\n') {
      row.push(field.trim());
      rows.push(row);
      row = [];
      field = '';
      i++;
    } else if (ch === '\n' || ch === '\r') {
      row.push(field.trim());
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field.trim());
    rows.push(row);
  }

  return rows.filter((r) => r.some((cell) => cell.length > 0));
}

export interface CsvValidatedPlayerRow {
  rowNumber: number;
  fullName: string;
  fullNameAr: string;
  nickname: string;
  nicknameAr: string;
  phone: string;
  email: string;
  status: PlayerStatus;
  valid: boolean;
  errorsEn: string[];
  errorsAr: string[];
}

const EmailValidator = z.string().email();

const HEADER_ALIASES: Record<string, string> = {
  fullname: 'fullName',
  'full_name': 'fullName',
  'full name': 'fullName',
  name: 'fullName',
  fullnamear: 'fullNameAr',
  'full_name_ar': 'fullNameAr',
  'arabic name': 'fullNameAr',
  nickname: 'nickname',
  'nick_name': 'nickname',
  handle: 'nickname',
  nicknamear: 'nicknameAr',
  'nickname_ar': 'nicknameAr',
  'arabic nickname': 'nicknameAr',
  phone: 'phone',
  mobile: 'phone',
  email: 'email',
  'e-mail': 'email',
  status: 'status',
};

export function parseAndValidatePlayerCsv(
  rawText: string,
  existingEmails: Set<string>
): CsvValidatedPlayerRow[] {
  const matrix = parseCsvText(rawText);
  if (matrix.length === 0) return [];

  // Detect whether first row is a header row
  const firstRowNormalized = matrix[0].map(
    (cell) => HEADER_ALIASES[cell.toLowerCase().trim()] ?? ''
  );
  const hasHeader = firstRowNormalized.some(Boolean);

  const colMap: Record<string, number> = hasHeader
    ? firstRowNormalized.reduce<Record<string, number>>((acc, key, idx) => {
        if (key) acc[key] = idx;
        return acc;
      }, {})
    : {
        fullName: 0,
        fullNameAr: 1,
        nickname: 2,
        nicknameAr: 3,
        phone: 4,
        email: 5,
        status: 6,
      };

  const dataRows = hasHeader ? matrix.slice(1) : matrix;
  const seenEmailsInCsv = new Set<string>();

  return dataRows.map((cells, idx) => {
    const rowNumber = hasHeader ? idx + 2 : idx + 1;
    const getCell = (key: string) => {
      const col = colMap[key];
      return col !== undefined ? (cells[col] ?? '').trim() : '';
    };

    const fullName = getCell('fullName');
    const fullNameAr = getCell('fullNameAr') || fullName;
    const nickname = getCell('nickname');
    const nicknameAr = getCell('nicknameAr') || nickname;
    const phone = getCell('phone') || '+20 100 555 0000';
    const rawEmail = getCell('email').toLowerCase();
    const rawStatus = getCell('status') || 'registered';

    const errorsEn: string[] = [];
    const errorsAr: string[] = [];

    if (!fullName || fullName.length < 2) {
      errorsEn.push('Full name is required (min 2 chars).');
      errorsAr.push('الاسم الكامل مطلوب (حرفان على الأقل).');
    }
    if (!nickname) {
      errorsEn.push('Nickname is required.');
      errorsAr.push('اللقب مطلوب.');
    }

    let email = rawEmail;
    if (!email) {
      errorsEn.push('Email address is required.');
      errorsAr.push('البريد الإلكتروني مطلوب.');
    } else if (!EmailValidator.safeParse(email).success) {
      errorsEn.push(`Invalid email "${email}".`);
      errorsAr.push(`بريد إلكتروني غير صالح "${email}".`);
    } else if (existingEmails.has(email)) {
      errorsEn.push('Email already exists in roster.');
      errorsAr.push('البريد الإلكتروني مسجل مسبقاً.');
    } else if (seenEmailsInCsv.has(email)) {
      errorsEn.push('Duplicate email inside CSV.');
      errorsAr.push('بريد إلكتروني مكرر داخل الملف.');
    } else {
      seenEmailsInCsv.add(email);
    }

    const parsedStatus = PlayerStatusSchema.safeParse(rawStatus);
    const status: PlayerStatus = parsedStatus.success
      ? parsedStatus.data
      : 'registered';
    if (rawStatus && !parsedStatus.success) {
      errorsEn.push(`Invalid status "${rawStatus}" (use registered, checkedIn, absent, active, eliminated, finalist).`);
      errorsAr.push(`حالة غير صالحة "${rawStatus}".`);
    }

    return {
      rowNumber,
      fullName,
      fullNameAr,
      nickname,
      nicknameAr,
      phone,
      email,
      status,
      valid: errorsEn.length === 0,
      errorsEn,
      errorsAr,
    };
  });
}

export const SAMPLE_PLAYERS_CSV = `fullName,fullNameAr,nickname,nicknameAr,phone,email,status
Ziad Tarek,زياد طارق,Zizo,زيزو,+20 100 555 2001,ziad.tarek@players.casino,registered
Malak Hossam,ملك حسام,Moka,موكا,+20 100 555 2002,malak.hossam@players.casino,checkedIn
Seif El-Din Amr,سيف الدين عمرو,Saifo,سيفو,+20 100 555 2003,seif.amr@players.casino,registered
Bad Row Example,صف للتجربة,Test,تست,+20 100 000 0000,not-a-valid-email,registered`;

function escapeCsvCell(val: unknown): string {
  const str = val === null || val === undefined ? '' : String(val);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Generates RFC-4180 CSV with UTF-8 BOM (\uFEFF) so Arabic characters render cleanly in Excel.
 */
export function buildCsvString(
  headers: string[],
  rows: Array<Array<unknown>>
): string {
  const lines = [
    headers.map(escapeCsvCell).join(','),
    ...rows.map((r) => r.map(escapeCsvCell).join(',')),
  ];
  return `\uFEFF${lines.join('\r\n')}`;
}

export function downloadCsvFile(
  filename: string,
  headers: string[],
  rows: Array<Array<unknown>>
): void {
  const csv = buildCsvString(headers, rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
