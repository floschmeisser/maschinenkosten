export type PdfReportInput = {
  title: string;
  lines: string[];
};

export function preparePdfReport(input: PdfReportInput): string {
  return [input.title, ...input.lines].join("\n");
}
