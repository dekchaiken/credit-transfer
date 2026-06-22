import Papa from 'papaparse';

/**
 * Parser สำหรับไฟล์รายชื่อนักศึกษา รองรับ 2 รูปแบบ:
 *  1. CSV (มาตรฐานของระบบ: studentId, fullName, [programCode]) — UTF-8
 *  2. .xls ที่ระบบทะเบียน RMUTK export ออกมา ซึ่งจริงๆ เป็น HTML table
 *     เข้ารหัส windows-874 (TIS-620) มี 3 คอลัมน์: ลำดับ, รหัสประจำตัว, ชื่อ-สกุล
 *     + มีบรรทัด header/ข้อมูลวิชาปนอยู่ด้านบนที่ต้องข้าม
 *
 * คืนค่าเป็น row ที่ normalize แล้ว { studentId, fullName, programCode }
 * พร้อม flag `garbledNames` เมื่อตรวจพบว่าชื่อภาษาไทยเพี้ยน (เช่น CSV ที่ export
 * ออกมาแล้วตัวอักษรไทยกลายเป็น '?').
 */

export type ParsedStudentRow = { studentId: string; fullName: string; programCode: string };
export type ParseResult = { rows: ParsedStudentRow[]; garbledNames: boolean; format: 'csv' | 'xls-html' };

// รูปแบบรหัสประจำตัวนักศึกษา RMUTK เช่น 65605180002-6 (11 หลัก - 1 หลัก)
// แต่เผื่อรูปแบบอื่นด้วย — ขอแค่ขึ้นต้นด้วยตัวเลขอย่างน้อย 8 หลัก
const STUDENT_ID_RE = /^\d{8,}(?:-\d)?$/;

/** ลบช่องว่างซ้ำ + trim */
function cleanText(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

/** ตรวจว่าชื่อมีตัวอักษรไทยจริงหรือเพี้ยน (กลายเป็น ? หรือ replacement char) */
function looksGarbled(name: string): boolean {
  if (!name) return false;
  // ถ้ามีอักษรไทยอย่างน้อย 1 ตัว ถือว่าปกติ
  if (/[฀-๿]/.test(name)) return false;
  // ไม่มีอักษรไทยเลย แต่มี ? หรือ replacement char ติดมา → เพี้ยน
  if (/[?�]/.test(name)) return true;
  return false;
}

/** decode bytes เป็น string โดยเดา encoding (windows-874 ก่อน, fallback utf-8) */
function decodeBytes(buf: Uint8Array): string {
  const utf8 = new TextDecoder('utf-8').decode(buf);
  // ถ้า utf-8 ถอดได้สะอาด (ไม่มี replacement char) และมีอักษรไทย → ใช้เลย
  if (!utf8.includes('�')) return utf8;
  // ไม่งั้นลอง windows-874 (TIS-620)
  try {
    return new TextDecoder('windows-874').decode(buf);
  } catch {
    return utf8;
  }
}

/** strip HTML tags + decode entity พื้นฐาน */
function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

/** parse ไฟล์ .xls แบบ HTML table (RMUTK) */
function parseXlsHtml(html: string): ParsedStudentRow[] {
  const rows: ParsedStudentRow[] = [];
  const trMatches = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
  for (const tr of trMatches) {
    const cells = (tr.match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/gi) || [])
      .map(c => cleanText(stripTags(c)));
    // หา cell ที่เป็นรหัสนักศึกษา
    const sidIdx = cells.findIndex(c => STUDENT_ID_RE.test(c));
    if (sidIdx === -1) continue;
    const studentId = cells[sidIdx];
    // ชื่ออยู่ใน cell ถัดไปที่มีข้อความ (ข้าม cell ว่าง)
    const fullName = cells.slice(sidIdx + 1).find(c => c.length > 0) || '';
    rows.push({ studentId, fullName, programCode: '' });
  }
  return rows;
}

/** parse ไฟล์ CSV */
function parseCsv(text: string): ParsedStudentRow[] {
  // ลองแบบมี header มาตรฐานก่อน
  const withHeader = Papa.parse(text, { header: true, skipEmptyLines: true });
  const headerRows = withHeader.data as Record<string, string>[];
  const fields = (withHeader.meta.fields || []).map(f => f.toLowerCase().trim());
  const hasStd = fields.includes('studentid') || fields.includes('fullname');

  if (hasStd) {
    return headerRows.map(r => {
      // หา key แบบ case-insensitive
      const get = (name: string) => {
        const key = Object.keys(r).find(k => k.toLowerCase().trim() === name);
        return key ? cleanText(String(r[key] ?? '')) : '';
      };
      return { studentId: get('studentid'), fullName: get('fullname'), programCode: get('programcode') };
    }).filter(r => r.studentId);
  }

  // ไม่มี header มาตรฐาน → parse แบบ array แล้วจับ column ที่เป็นรหัส (เช่น export จากทะเบียน)
  const noHeader = Papa.parse(text, { header: false, skipEmptyLines: true });
  const arrRows = noHeader.data as string[][];
  const rows: ParsedStudentRow[] = [];
  for (const cols of arrRows) {
    const cleaned = cols.map(c => cleanText(String(c ?? '')));
    const sidIdx = cleaned.findIndex(c => STUDENT_ID_RE.test(c));
    if (sidIdx === -1) continue;
    const studentId = cleaned[sidIdx];
    const fullName = cleaned.slice(sidIdx + 1).find(c => c.length > 0) || '';
    rows.push({ studentId, fullName, programCode: '' });
  }
  return rows;
}

/**
 * Entry point — รับ raw bytes ของไฟล์ ตัดสินใจ format แล้ว parse
 */
export function parseStudentFile(buf: Uint8Array): ParseResult {
  const text = decodeBytes(buf);
  const looksHtml = /<table|<tr[\s>]|<html|<td[\s>]/i.test(text.slice(0, 4000));

  let rows: ParsedStudentRow[];
  let format: 'csv' | 'xls-html';
  if (looksHtml) {
    rows = parseXlsHtml(text);
    format = 'xls-html';
  } else {
    rows = parseCsv(text);
    format = 'csv';
  }

  const garbledNames = rows.some(r => looksGarbled(r.fullName));
  return { rows, garbledNames, format };
}
