import { createRequire } from 'node:module';
import ExcelJS from 'exceljs';
import { BadRequestException } from '@nestjs/common';

const require = createRequire(__filename);
const JSZip = require('jszip') as {
  loadAsync(data: Buffer): Promise<{
    files: Record<string, unknown>;
    file(name: string, data?: string): { async(kind: 'string'): Promise<string> } | null;
    generateAsync(options: { type: 'nodebuffer' }): Promise<Buffer>;
  }>;
};
import {
  assessImportDraft,
  buildQuestionTemplate,
  previewQuestionWorkbook,
} from './question-import';

const header = [
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
];

async function workbook(rows: unknown[][], sheetName = 'Questions'): Promise<Buffer> {
  const file = new ExcelJS.Workbook();
  const sheet = file.addWorksheet(sheetName);
  sheet.addRow(header);
  for (const row of rows) {
    sheet.addRow(row);
  }
  return Buffer.from(await file.xlsx.writeBuffer());
}

describe('question Excel import', () => {
  it('reads a valid MCQ, poll, and written question in order', async () => {
    const preview = await previewQuestionWorkbook(
      await workbook([
        ['MCQ', 'Which planet is closest to the sun?', 'Mercury', 'Venus', '', '', '', '', 'A', 30],
        ['poll', 'Which topic next?', 'Routing', 'Security', '', '', '', '', '', ''],
        ['TEXT', 'What will you try first?', '', '', '', '', '', '', '', ''],
      ]),
    );

    expect(preview.fileError).toBeNull();
    expect(preview.rows.map((row) => row.type)).toEqual(['MCQ', 'POLL', 'TEXT']);
    expect(preview.rows.map((row) => row.row)).toEqual([2, 3, 4]);
    expect(preview.rows.every((row) => row.errors.length === 0 && row.included)).toBe(true);
    expect(preview.rows[0]).toMatchObject({
      prompt: 'Which planet is closest to the sun?',
      correctAnswer: 'A',
      duration: '30',
      options: ['Mercury', 'Venus', '', '', '', ''],
    });
    expect(preview.rows[2]?.options.every((option) => option === '')).toBe(true);
  });

  it('reports the Excel row for invalid questions and skips blank rows', async () => {
    const preview = await previewQuestionWorkbook(
      await workbook([
        ['MCQ', '', 'Only one', '', '', '', '', '', 'A', ''],
        [],
        ['MCQ', 'Gap', 'Yes', '', 'No', '', '', '', 'C', ''],
        ['MCQ', 'Missing mark', 'Yes', 'No', '', '', '', '', '', ''],
        ['MCQ', 'Bad mark', 'Yes', 'No', '', '', '', '', 'C', ''],
        ['POLL', 'Graded poll', 'Yes', 'No', '', '', '', '', 'A', ''],
        ['TEXT', 'Notes', 'Should not be here', '', '', '', '', '', 'A', 2],
        ['QUIZ', 'Unknown', 'Yes', 'No', '', '', '', '', '', ''],
      ]),
    );

    expect(preview.rows.map((row) => row.row)).toEqual([2, 4, 5, 6, 7, 8, 9]);
    expect(preview.rows[0]?.errors.join(' ')).toMatch(/Row 2: Question text is required/);
    expect(preview.rows[0]?.errors.join(' ')).toMatch(/2 to 6 options/);
    expect(preview.rows[1]?.errors.join(' ')).toMatch(/Row 4: Fill options from A without leaving a gap/);
    expect(preview.rows[2]?.errors.join(' ')).toMatch(/Row 5: An MCQ needs a correct answer/);
    expect(preview.rows[3]?.errors.join(' ')).toMatch(/Row 6: Correct Answer C does not match an option/);
    expect(preview.rows[4]?.errors.join(' ')).toMatch(/Row 7: A poll cannot have a correct answer/);
    expect(preview.rows[5]?.errors.join(' ')).toMatch(/Row 8: A written question cannot have answer options/);
    expect(preview.rows[5]?.errors.join(' ')).toMatch(/cannot have a correct answer/);
    expect(preview.rows[5]?.errors.join(' ')).toMatch(/Duration must be from 5 to 600/);
    expect(preview.rows[6]?.errors.join(' ')).toMatch(/Row 9: Type must be MCQ, POLL, or TEXT/);
    expect(preview.rows.every((row) => row.included === false)).toBe(true);
  });

  it('rejects a workbook that is not the LiveQ template', async () => {
    const file = new ExcelJS.Workbook();
    file.addWorksheet('Questions').addRow(['Hello']);
    const preview = await previewQuestionWorkbook(Buffer.from(await file.xlsx.writeBuffer()));
    expect(preview.fileError).toMatch(/Type and Question/);
    expect(preview.rows).toEqual([]);
  });

  it('rejects a file that is not an Excel workbook', async () => {
    await expect(previewQuestionWorkbook(Buffer.from('not-a-workbook'))).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('reads questions after Excel rewrites the template dropdowns', async () => {
    const file = new ExcelJS.Workbook();
    const sheet = file.addWorksheet('Questions');
    sheet.addRow(header);
    sheet.addRow([
      'MCQ',
      'Which planet is closest to the sun?',
      'Mercury',
      'Venus',
      '',
      '',
      '',
      '',
      'A',
      30,
    ]);
    sheet.getCell(2, 1).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['"MCQ,POLL,TEXT"'],
    };
    const zip = await JSZip.loadAsync(Buffer.from(await file.xlsx.writeBuffer()));
    const sheetName = Object.keys(zip.files).find((name) => name.endsWith('sheet1.xml')) ?? '';
    const xml = (await zip.file(sheetName)?.async('string')) ?? '';
    zip.file(sheetName, xml.replace(/sqref="[^"]*"/, 'xr:uid="{1}"'));
    const savedByExcel = Buffer.from(await zip.generateAsync({ type: 'nodebuffer' }));

    const preview = await previewQuestionWorkbook(savedByExcel);

    expect(preview.fileError).toBeNull();
    expect(preview.rows[0]).toMatchObject({
      type: 'MCQ',
      prompt: 'Which planet is closest to the sun?',
      correctAnswer: 'A',
    });
  });

  it('reads a workbook saved with a spreadsheet namespace prefix', async () => {
    const file = new ExcelJS.Workbook();
    const sheet = file.addWorksheet('Questions');
    sheet.addRow(header);
    sheet.addRow([
      'MCQ',
      'Quelle commande permet de lire des données ?',
      'SELECT',
      'INSERT',
      '',
      '',
      '',
      '',
      'A',
      30,
    ]);
    const zip = await JSZip.loadAsync(Buffer.from(await file.xlsx.writeBuffer()));
    for (const name of Object.keys(zip.files)) {
      if (!name.endsWith('.xml')) {
        continue;
      }
      const xml = (await zip.file(name)?.async('string')) ?? '';
      if (!xml.includes('xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"')) {
        continue;
      }
      zip.file(name, prefixSpreadsheet(xml));
    }

    const preview = await previewQuestionWorkbook(
      Buffer.from(await zip.generateAsync({ type: 'nodebuffer' })),
    );

    expect(preview.fileError).toBeNull();
    expect(preview.rows[0]).toMatchObject({
      type: 'MCQ',
      prompt: 'Quelle commande permet de lire des données ?',
      correctAnswer: 'A',
      duration: '30',
      options: ['SELECT', 'INSERT', '', '', '', ''],
    });
  });

  it('keeps an answer that Excel stored as a formula', async () => {
    const file = new ExcelJS.Workbook();
    const sheet = file.addWorksheet('Questions');
    sheet.addRow(header);
    sheet.addRow(['MCQ', 'Which sign means equal?', '', '==', '', '', '', '', 'A', '']);
    sheet.getCell(2, 3).value = { formula: '=', result: { error: '#NAME?' } };

    const preview = await previewQuestionWorkbook(Buffer.from(await file.xlsx.writeBuffer()));

    expect(preview.rows[0]?.options[0]).toBe('=');
    expect(preview.rows[0]?.options[1]).toBe('==');
  });

  it('builds a template whose question sheet is empty and ignores the example sheet', async () => {
    const preview = await previewQuestionWorkbook(await buildQuestionTemplate());
    expect(preview.fileError).toBeNull();
    expect(preview.rows).toEqual([]);
  });

  it('checks the same rules used before confirmation', () => {
    expect(
      assessImportDraft({
        row: 3,
        type: 'MCQ',
        prompt: 'Ready?',
        options: ['Yes', 'No', '', '', '', ''],
        correctAnswer: 'B',
        duration: '',
      }),
    ).toEqual([]);
    expect(
      assessImportDraft({
        row: 8,
        type: 'TEXT',
        prompt: 'Notes',
        options: ['Nope', '', '', '', '', ''],
        correctAnswer: '',
        duration: '45',
      }).join(' '),
    ).toMatch(/Row 8: A written question cannot have answer options/);
  });
});

function prefixSpreadsheet(xml: string): string {
  const namespace = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  return xml
    .replace(`xmlns="${namespace}"`, `xmlns:x="${namespace}"`)
    .replace(/<(\/?)([A-Za-z][\w.]*)/g, (match, slash: string, name: string) =>
      name.includes(':') ? match : `<${slash}x:${name}`,
    );
}
