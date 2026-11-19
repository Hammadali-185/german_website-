function needsFormulaGuard(value: string) {
  return /^[\t\r\n ]*[=+\-@]/.test(value);
}

export function csvCell(value: unknown) {
  const text = value == null ? "" : String(value);
  const guarded = needsFormulaGuard(text) ? `'${text}` : text;
  return `"${guarded.replaceAll('"', '""')}"`;
}

export function csvRow(values: unknown[]) {
  return values.map(csvCell).join(",");
}

export function csvDocument(rows: unknown[][]) {
  return `\uFEFF${rows.map(csvRow).join("\r\n")}\r\n`;
}
