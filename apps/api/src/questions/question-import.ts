import { createRequire } from 'node:module';
import { BadRequestException } from '@nestjs/common';
import ExcelJS from 'exceljs';

const loadModule = createRequire(__filename);
const JSZip = loadModule('jszip') as {
  loadAsync(data: Buffer): Promise<ZipArchive>;
};

type ZipEntry = {
  dir: boolean;
  async(type: 'string'): Promise<string>;
};

type ZipArchive = {
  file(path: string, data: string): void;
  forEach(callback: (path: string, entry: ZipEntry) => void): void;
  generateAsync(options: { type: 'nodebuffer'; compression: 'DEFLATE' }): Promise<Buffer>;
};

const spreadsheetNamespace = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';

const letters = ['A', 'B', 'C', 'D', 'E', 'F'] as const;
const headers = [
  'Type',
  'Question',
  'Option A',
  'Option B',
  'Option C',
  'Option D',
  'Option E',
  'Option F',
  'Correct Answer',
  'Duration',
] as const;

const maxRows = 100;
const maxPrompt = 4000;
const maxOption = 500;

export interface ImportDraft {
  row: number;
  included: boolean;
  type: string;
  prompt: string;
  options: string[];
  correctAnswer: string;
  duration: string;
  errors: string[];
}

export interface QuestionImportPreview {
  fileError: string | null;
  rows: ImportDraft[];
}

export function assessImportDraft(draft: {
  row: number;
  type: string;
  prompt: string;
  options: string[];
  correctAnswer: string;
  duration: string;
}): string[] {
  const errors: string[] = [];
  const type = draft.type.trim().toUpperCase();
  const prompt = draft.prompt.trim();
  const options = letters.map((_, index) => (draft.options[index] ?? '').trim());
  const correct = draft.correctAnswer.trim().toUpperCase();
  const filled = options.map((label, index) => ({ label, index })).filter((option) => option.label);

  if (type !== 'MCQ' && type !== 'POLL' && type !== 'TEXT') {
    errors.push(`Row ${draft.row}: Type must be MCQ, POLL, or TEXT.`);
  }
  if (!prompt) {
    errors.push(`Row ${draft.row}: Question text is required.`);
  } else if (prompt.length > maxPrompt) {
    errors.push(`Row ${draft.row}: Question text must be ${maxPrompt} characters or fewer.`);
  }

  const gap = options.findIndex((label, index) => !label && options.slice(index + 1).some(Boolean));
  if (gap >= 0) {
    errors.push(`Row ${draft.row}: Fill options from A without leaving a gap.`);
  }

  if (type === 'TEXT') {
    if (filled.length > 0) {
      errors.push(`Row ${draft.row}: A written question cannot have answer options.`);
    }
    if (correct) {
      errors.push(`Row ${draft.row}: A written question cannot have a correct answer.`);
    }
  }

  if (type === 'MCQ' || type === 'POLL') {
    if (filled.length < 2 || filled.length > 6) {
      errors.push(`Row ${draft.row}: A choice question needs 2 to 6 options.`);
    }
    const longOption = filled.find((option) => option.label.length > maxOption);
    if (longOption) {
      errors.push(`Row ${draft.row}: Each option must be ${maxOption} characters or fewer.`);
    }
  }

  if (type === 'POLL' && correct) {
    errors.push(`Row ${draft.row}: A poll cannot have a correct answer.`);
  }
  if (type === 'MCQ') {
    if (!correct) {
      errors.push(`Row ${draft.row}: An MCQ needs a correct answer from A to F.`);
    } else if (!letters.includes(correct as (typeof letters)[number])) {
      errors.push(`Row ${draft.row}: Correct Answer must be a letter from A to F.`);
    } else if (!options[correct.charCodeAt(0) - 65]) {
      errors.push(`Row ${draft.row}: Correct Answer ${correct} does not match an option.`);
    }
  }
  if (type !== 'MCQ' && correct && type !== 'POLL' && type !== 'TEXT') {
    if (!letters.includes(correct as (typeof letters)[number])) {
      errors.push(`Row ${draft.row}: Correct Answer must be a letter from A to F.`);
    }
  }

  const duration = draft.duration.trim();
  if (duration) {
    if (!/^\d+$/.test(duration)) {
      errors.push(`Row ${draft.row}: Duration must be a whole number of seconds, or be left empty.`);
    } else {
      const seconds = Number(duration);
      if (seconds < 5 || seconds > 600) {
        errors.push(`Row ${draft.row}: Duration must be from 5 to 600 seconds, or be left empty.`);
      }
    }
  }

  return errors;
}

export async function buildQuestionTemplate(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'LiveQ';
  const sheet = workbook.addWorksheet('Questions');
  sheet.addRow([...headers]);
  sheet.getRow(1).font = { bold: true };
  sheet.columns = [
    { width: 14 },
    { width: 48 },
    { width: 24 },
    { width: 24 },
    { width: 24 },
    { width: 24 },
    { width: 24 },
    { width: 24 },
    { width: 18 },
    { width: 14 },
  ];
  for (let row = 2; row <= maxRows + 1; row += 1) {
    sheet.getCell(row, 1).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['"MCQ,POLL,TEXT"'],
    };
    sheet.getCell(row, 9).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['"A,B,C,D,E,F"'],
    };
  }

  const example = workbook.addWorksheet('Example');
  example.addRow([...headers]);
  example.getRow(1).font = { bold: true };
  example.addRow(['MCQ', 'Which planet is closest to the sun?', 'Mercury', 'Venus', 'Earth', '', '', '', 'A', 30]);
  example.addRow(['POLL', 'Which topic should we cover next?', 'Routing', 'Security', '', '', '', '', '', '']);
  example.addRow(['TEXT', 'What will you try first after this session?', '', '', '', '', '', '', '', 45]);
  const notes = workbook.addWorksheet('Notes');
  notes.getColumn(1).width = 110;
  notes.addRows([
    ['MCQ is a graded choice and needs a correct answer from A to F.'],
    ['POLL is an ungraded choice and must not have a correct answer.'],
    ['TEXT is a written answer and must not have options or a correct answer.'],
    ['Use 2 to 6 options, filled from A without gaps. Leave unused options empty.'],
    ['Duration is optional, from 5 to 600 seconds. LiveQ checks it, then uses the timer you set when you launch.'],
    ['Put questions on the Questions sheet. This example sheet is not imported.'],
  ]);

  const file = await workbook.xlsx.writeBuffer();
  return Buffer.from(file);
}

async function normalizeSpreadsheet(file: Buffer): Promise<Buffer> {
  let zip: ZipArchive;
  try {
    zip = await JSZip.loadAsync(file);
  } catch {
    return Buffer.from(file);
  }

  const entries: Array<{ path: string; entry: ZipEntry }> = [];
  zip.forEach((path, entry) => {
    if (!entry.dir && path.endsWith('.xml')) {
      entries.push({ path, entry });
    }
  });

  let changed = false;
  await Promise.all(
    entries.map(async ({ path, entry }) => {
      const xml = await entry.async('string');
      const normalized = stripSpreadsheetPrefix(xml);
      if (normalized !== xml) {
        zip.file(path, normalized);
        changed = true;
      }
    }),
  );
  if (!changed) {
    return Buffer.from(file);
  }
  return Buffer.from(await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));
}

function stripSpreadsheetPrefix(xml: string): string {
  if (!xml.includes(`xmlns:x="${spreadsheetNamespace}"`) && !xml.includes('<x:')) {
    return xml;
  }
  return xml
    .replaceAll(`xmlns:x="${spreadsheetNamespace}"`, `xmlns="${spreadsheetNamespace}"`)
    .replaceAll('</x:', '</')
    .replaceAll('<x:', '<');
}

export async function previewQuestionWorkbook(file: Buffer): Promise<QuestionImportPreview> {
  const workbook = new ExcelJS.Workbook();
  try {
    // Some editors save the spreadsheet with an x: prefix ExcelJS does not read.
    // Dropdowns are ignored; only the cell values are imported.
    const normalized = await normalizeSpreadsheet(file);
    await workbook.xlsx.load(normalized as unknown as ExcelJS.Buffer, {
      ignoreNodes: ['dataValidations'],
    });
  } catch {
    throw new BadRequestException('This file is not a valid Excel .xlsx workbook.');
  }

  const sheet = workbook.getWorksheet('Questions') ?? workbook.worksheets[0];
  if (!sheet) {
    return { fileError: 'The workbook has no worksheet.', rows: [] };
  }

  const header = sheet.getRow(1);
  const columns = new Map<string, number>();
  header.eachCell((cell, index) => {
    columns.set(cellText(cell.value).toLowerCase(), index);
  });
  const missing = ['type', 'question'].filter((name) => !columns.has(name));
  if (missing.length > 0) {
    return {
      fileError: 'The first row must include Type and Question, as in the LiveQ template.',
      rows: [],
    };
  }

  const rows: ImportDraft[] = [];
  let overflow = false;
  sheet.eachRow((excelRow, rowNumber) => {
    if (rowNumber === 1) {
      return;
    }
    const type = readColumn(excelRow, columns, 'type');
    const prompt = readColumn(excelRow, columns, 'question');
    const options = letters.map((letter) => readColumn(excelRow, columns, `option ${letter.toLowerCase()}`));
    const correctAnswer = readColumn(excelRow, columns, 'correct answer');
    const duration = readColumn(excelRow, columns, 'duration');
    if (![type, prompt, correctAnswer, duration, ...options].some(Boolean)) {
      return;
    }
    if (rows.length >= maxRows) {
      overflow = true;
      return;
    }
    const draft = {
      row: rowNumber,
      type: type.toUpperCase(),
      prompt,
      options,
      correctAnswer: correctAnswer.toUpperCase(),
      duration,
    };
    const errors = assessImportDraft(draft);
    rows.push({
      ...draft,
      included: errors.length === 0,
      errors,
    });
  });

  return {
    fileError: overflow ? `Only the first ${maxRows} questions can be imported.` : null,
    rows,
  };
}

function readColumn(row: ExcelJS.Row, columns: Map<string, number>, name: string): string {
  const index = columns.get(name);
  if (!index) {
    return '';
  }
  return cellText(row.getCell(index).value);
}

function cellText(value: ExcelJS.CellValue): string {
  if (value == null) {
    return '';
  }
  if (typeof value === 'string') {
    return value.trim();
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value).trim() : '';
  }
  if (typeof value === 'boolean') {
    return value ? 'TRUE' : 'FALSE';
  }
  if (value instanceof Date) {
    return '';
  }
  if (typeof value === 'object') {
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join('').trim();
    }
    if ('formula' in value && typeof value.formula === 'string') {
      const result = 'result' in value ? value.result : undefined;
      const errorResult = typeof result === 'object' && result !== null && 'error' in result;
      if (result != null && !errorResult) {
        return cellText(result as ExcelJS.CellValue);
      }
      return value.formula.trim();
    }
    if ('result' in value && value.result != null) {
      return cellText(value.result as ExcelJS.CellValue);
    }
    if ('text' in value && typeof value.text === 'string') {
      return value.text.trim();
    }
  }
  return '';
}
