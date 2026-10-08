import ExcelJS from 'exceljs';
import { buildReport } from './report.math';
import {
  renderReportPdf,
  renderReportWorkbook,
  reportFilename,
} from './report.documents';
import type { ReportSource } from './report.types';

const published: ReportSource = {
  id: 'session-1',
  title: 'Opening lecture',
  status: 'ENDED',
  startedAt: '2026-11-01T09:00:00.000Z',
  endedAt: '2026-11-01T10:30:00.000Z',
  participantCount: 2,
  questions: [
    {
      id: 'question-1',
      prompt: 'What is 2 + 2?',
      position: 1,
      options: [
        { id: 'three', label: '3', position: 1 },
        { id: 'four', label: '4', position: 2 },
      ],
      correctOptionId: 'four',
      run: {
        published: true,
        votes: [
          { optionId: 'four', participantId: 'ada' },
          { optionId: 'three', participantId: 'grace' },
        ],
      },
    },
  ],
};

describe('report documents', () => {
  it('names the download from the conference title', () => {
    expect(reportFilename('Opening lecture', 'pdf')).toBe('liveq-opening-lecture.pdf');
    expect(reportFilename('   ', 'xlsx')).toBe('liveq-report.xlsx');
  });

  it('writes a PDF and an Excel workbook with the published result', async () => {
    const report = buildReport(published);
    const pdf = await renderReportPdf(report);
    expect(pdf.subarray(0, 5).toString('ascii')).toBe('%PDF-');

    const workbook = new ExcelJS.Workbook();
    const file = await renderReportWorkbook(report);
    await workbook.xlsx.load(file as unknown as Parameters<typeof workbook.xlsx.load>[0]);
    const summary = workbook.getWorksheet('Summary');
    const options = workbook.getWorksheet('Options');
    expect(summary?.getCell('B2').value).toBe('Opening lecture');
    expect(summary?.getCell('B9').value).toBe(50);
    expect(options?.getCell('B3').value).toBe('4');
    expect(options?.getCell('E3').value).toBe('Yes');
  });
});
