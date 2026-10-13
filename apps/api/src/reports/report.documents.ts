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

    doc.fontSize(22).text('LiveQ report');
    doc.moveDown(0.4);
    doc.fontSize(16).text(report.title);
    doc.moveDown(0.4);
    doc.fontSize(11).fillColor('#444444');
    doc.text(`Status: ${labelStatus(report.status)}`);
    doc.text(`Started: ${report.startedAt ?? 'Not yet'}`);
    doc.text(`Ended: ${report.endedAt ?? 'Not yet'}`);
    doc.moveDown();
    doc.fillColor('#000000').fontSize(13).text('Conference statistics');
    doc.moveDown(0.3);
    doc.fontSize(11);
    doc.text(`Participants: ${report.participantCount}`);
    doc.text(`Participation: ${report.participationPercent}%`);
    doc.text(`Voting: ${report.votingPercent}%`);
    doc.text(`Correct answers: ${formatPercent(report.correctPercent)}`);
    doc.text(
      `Questions: ${report.publishedQuestionCount} published of ${report.questionCount}`,
    );
    doc.text(`Votes submitted: ${report.voteCount}`);
    doc.moveDown();

    if (report.questions.length === 0) {
      doc.text('This conference has no questions yet.');
    }

    for (const question of report.questions) {
      doc
        .fontSize(13)
        .fillColor('#000000')
        .text(`${question.position}. ${question.prompt}`);
      doc.moveDown(0.2);
      doc.fontSize(11);
      if (!question.published) {
        doc
          .fillColor('#444444')
          .text(
            `Results not published. ${question.voteCount} ${question.voteCount === 1 ? 'vote' : 'votes'} submitted.`,
          );
        doc.moveDown();
        continue;
      }
      doc
        .fillColor('#000000')
        .text(
          `Voting: ${question.votingPercent}% · ${question.voteCount} ${question.voteCount === 1 ? 'vote' : 'votes'}`,
        );
      if (question.correctPercent !== null) {
        doc.text(`Correct answers: ${question.correctPercent}%`);
      } else if (question.graded) {
        doc.text('No votes on this graded question.');
      } else if (question.kind === 'TEXT') {
        doc.text('Written answers');
      } else {
        doc.text('Opinion poll');
      }
      for (const response of question.responses) {
        doc.text(`• ${response}`);
      }
      for (const option of question.options) {
        const mark = option.optionId === question.correctOptionId ? ' (correct)' : '';
        doc.text(`• ${option.label}${mark}: ${option.count} (${option.percent}%)`);
      }
      doc.moveDown();
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
