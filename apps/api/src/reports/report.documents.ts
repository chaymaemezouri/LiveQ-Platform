import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import type { SessionReport } from './report.types';

export function reportFilename(title: string, extension: 'pdf' | 'xlsx'): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return `liveq-${slug || 'report'}.${extension}`;
}

export function renderReportPdf(report: SessionReport): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const left = 48;
    const width = 499;
    const tones = ['#3b82f6', '#f43f5e', '#10b981', '#8b5cf6', '#f59e0b'];
    let y = 108;

    doc.rect(0, 0, 595, 96).fill('#eff6ff');
    doc.rect(left, 34, 4, 28).fill('#2563eb');
    doc.fillColor('#0f172a').fontSize(20).text(report.title, 60, 30, { width: 470 });
    doc
      .fillColor('#64748b')
      .fontSize(9)
      .text(
        `${labelStatus(report.status)} · Started ${report.startedAt ?? 'not yet'} · Ended ${report.endedAt ?? 'not yet'}`,
        60,
        58,
        { width: 470 },
      );

    const stats: [string, string, string][] = [
      ['Participants', String(report.participantCount), '#3b82f6'],
      ['Participation', `${report.participationPercent}%`, '#10b981'],
      ['Voting', `${report.votingPercent}%`, '#f59e0b'],
      ['Correct', formatPercent(report.correctPercent), '#8b5cf6'],
    ];
    const cardW = (width - 18) / 4;
    for (const [index, stat] of stats.entries()) {
      const x = left + index * (cardW + 6);
      doc.roundedRect(x, y, cardW, 48, 8).fill('#f8fafc');
      doc.rect(x, y + 8, 3, 32).fill(stat[2]);
      doc.fillColor('#64748b').fontSize(7).text(stat[0], x + 10, y + 8, { width: cardW - 16 });
      doc.fillColor('#0f172a').fontSize(14).text(stat[1], x + 10, y + 22, { width: cardW - 16 });
    }
    y += 62;
    doc
      .fillColor('#64748b')
      .fontSize(9)
      .text(
        `${report.publishedQuestionCount} of ${report.questionCount} questions published · ${report.voteCount} votes submitted`,
        left,
        y,
        { width },
      );
    y = doc.y + 16;

    if (report.questions.length === 0) {
      doc.fillColor('#64748b').fontSize(11).text('This conference has no questions yet.', left, y);
    }

    for (const question of report.questions) {
      if (y > 740) {
        doc.addPage();
        y = 48;
      }
      const tone = tones[(question.position - 1) % tones.length] ?? '#3b82f6';
      doc.circle(left + 6, y + 8, 4).fill(tone);
      doc.fillColor('#0f172a').fontSize(12).text(question.prompt, left + 16, y, { width: width - 16 });
      y = doc.y + 2;
      const kind =
        question.kind === 'TEXT' ? 'Written answer' : question.graded ? 'Graded' : 'Opinion poll';
      doc
        .fillColor('#64748b')
        .fontSize(8)
        .text(
          `Question ${question.position} · ${kind} · ${question.votingPercent}% voted · ${question.voteCount} votes${question.correctPercent === null ? '' : ` · ${question.correctPercent}% correct`}`,
          left + 16,
          y,
          { width: width - 16 },
        );
      y = doc.y + 6;
      if (!question.published) {
        doc
          .fillColor('#64748b')
          .fontSize(9)
          .text('Results are not published, so the answer split stays hidden.', left + 16, y, {
            width: width - 16,
          });
        y = doc.y + 14;
        continue;
      }
      for (const response of question.responses) {
        doc.fillColor('#0f172a').fontSize(9).text(response, left + 16, y, { width: width - 16 });
        y = doc.y + 4;
      }
      question.options.forEach((option, index) => {
        const color = tones[index % tones.length] ?? '#3b82f6';
        const mark = option.optionId === question.correctOptionId ? '  CORRECT' : '';
        doc.fillColor('#0f172a').fontSize(8).text(`${option.label}${mark}`, left + 16, y, {
          width: width - 90,
        });
        doc.text(`${option.percent}% · ${option.count}`, left + width - 70, y, { width: 70, align: 'right' });
        y = doc.y + 2;
        const bar = width - 32;
        doc.roundedRect(left + 16, y, bar, 4, 2).fill('#e2e8f0');
        if (option.percent > 0) {
          doc.roundedRect(left + 16, y, Math.max(4, (bar * option.percent) / 100), 4, 2).fill(color);
        }
        y += 12;
      });
      y += 8;
    }

    doc.end();
  });
}

export async function renderReportWorkbook(report: SessionReport): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'LiveQ';
  workbook.created = new Date();

  const summary = workbook.addWorksheet('Summary');
  summary.columns = [
    { header: 'Field', key: 'field', width: 28 },
    { header: 'Value', key: 'value', width: 48 },
  ];
  summary.addRows([
    ['Conference', report.title],
    ['Status', labelStatus(report.status)],
    ['Started', report.startedAt ?? ''],
    ['Ended', report.endedAt ?? ''],
    ['Participants', report.participantCount],
    ['Participation %', report.participationPercent],
    ['Voting %', report.votingPercent],
    ['Correct answer %', report.correctPercent ?? ''],
    ['Questions', report.questionCount],
    ['Questions asked', report.askedQuestionCount],
    ['Questions published', report.publishedQuestionCount],
    ['Votes submitted', report.voteCount],
  ]);
  summary.getRow(1).font = { bold: true };

  const questions = workbook.addWorksheet('Questions');
  questions.columns = [
    { header: 'Position', key: 'position', width: 12 },
    { header: 'Prompt', key: 'prompt', width: 48 },
    { header: 'Published', key: 'published', width: 14 },
    { header: 'Kind', key: 'kind', width: 16 },
    { header: 'Votes', key: 'votes', width: 12 },
    { header: 'Voting %', key: 'voting', width: 12 },
    { header: 'Correct %', key: 'correct', width: 12 },
  ];
  questions.getRow(1).font = { bold: true };
  for (const question of report.questions) {
    questions.addRow([
      question.position,
      question.prompt,
      question.published ? 'Yes' : 'No',
      question.kind === 'TEXT' ? 'Written answer' : question.graded ? 'Graded' : 'Opinion poll',
      question.voteCount,
      question.votingPercent,
      question.correctPercent ?? '',
    ]);
  }

  const options = workbook.addWorksheet('Options');
  options.columns = [
    { header: 'Question', key: 'question', width: 12 },
    { header: 'Option', key: 'option', width: 36 },
    { header: 'Votes', key: 'votes', width: 12 },
    { header: 'Percent', key: 'percent', width: 12 },
    { header: 'Correct', key: 'correct', width: 12 },
  ];
  options.getRow(1).font = { bold: true };
  for (const question of report.questions) {
    if (!question.published) {
      continue;
    }
    for (const option of question.options) {
      options.addRow([
        question.position,
        option.label,
        option.count,
        option.percent,
        option.optionId === question.correctOptionId ? 'Yes' : '',
      ]);
    }
  }

  const written = workbook.addWorksheet('Written answers');
  written.columns = [
    { header: 'Question', key: 'question', width: 12 },
    { header: 'Prompt', key: 'prompt', width: 48 },
    { header: 'Answer', key: 'answer', width: 48 },
  ];
  written.getRow(1).font = { bold: true };
  for (const question of report.questions) {
    if (!question.published || question.kind !== 'TEXT') {
      continue;
    }
    for (const response of question.responses) {
      written.addRow([question.position, question.prompt, response]);
    }
  }

  const raw = await workbook.xlsx.writeBuffer();
  return Buffer.from(raw);
}

function formatPercent(value: number | null): string {
  return value === null ? 'Not available' : `${value}%`;
}

function labelStatus(status: SessionReport['status']): string {
  if (status === 'ACTIVE') {
    return 'Active';
  }
  if (status === 'ENDED') {
    return 'Ended';
  }
  return 'Draft';
}
