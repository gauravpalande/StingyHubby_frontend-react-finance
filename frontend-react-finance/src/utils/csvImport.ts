

type ImportNumericField =
  | 'income'
  | 'checking'
  | 'emergency'
  | 'health'
  | 'retirement'
  | 'creditCards'
  | 'mortgage'
  | 'carPayments'
  | 'utilities';

type ImportedSubmission = Record<ImportNumericField, number> & {
  user_id: string;
  created_at: string;
};

const IMPORT_HEADER_TO_FIELD: Record<string, ImportNumericField | 'created_at'> = {
  date: 'created_at',
  income: 'income',
  checking: 'checking',
  emergency: 'emergency',
  health: 'health',
  retirement: 'retirement',
  'credit cards': 'creditCards',
  mortgage: 'mortgage',
  'car payments': 'carPayments',
  utilities: 'utilities',
};

const REQUIRED_IMPORT_HEADERS = Object.keys(IMPORT_HEADER_TO_FIELD);

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
}

function normalizeCsvHeader(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function parseImportAmount(value: string, rowNumber: number, field: string) {
  const normalized = value.replace(/[$,]/g, '').trim();
  const amount = Number(normalized || 0);

  if (!Number.isFinite(amount)) {
    throw new Error(`Row ${rowNumber}: ${field} must be a valid number.`);
  }

  return amount;
}

function parseImportDate(value: string, rowNumber: number) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`Row ${rowNumber}: Date must be a valid date.`);
  }

  return date.toISOString();
}

function buildImportedSubmissions(csv: string, userId: string) {
  const lines = csv.split(/\r?\n/).filter((line) => line.trim());
  const headerLine = lines[0];

  if (!headerLine) {
    throw new Error('CSV file is empty.');
  }

  const fieldsByIndex = parseCsvLine(headerLine).map(
    (header) => IMPORT_HEADER_TO_FIELD[normalizeCsvHeader(header)]
  );

  const missingHeaders = REQUIRED_IMPORT_HEADERS.filter(
    (header) => !fieldsByIndex.includes(IMPORT_HEADER_TO_FIELD[header])
  );

  if (missingHeaders.length) {
    throw new Error(`CSV is missing required headers: ${missingHeaders.join(', ')}.`);
  }

  return lines.slice(1).map((line, index) => {
    const rowNumber = index + 2;
    const values = parseCsvLine(line);
    const submission: ImportedSubmission = {
      user_id: userId,
      created_at: '',
      income: 0,
      checking: 0,
      emergency: 0,
      health: 0,
      retirement: 0,
      creditCards: 0,
      mortgage: 0,
      carPayments: 0,
      utilities: 0,
    };

    fieldsByIndex.forEach((field, columnIndex) => {
      if (!field) return;

      const rawValue = values[columnIndex] ?? '';
      if (field === 'created_at') {
        submission.created_at = parseImportDate(rawValue, rowNumber);
      } else {
        submission[field] = parseImportAmount(rawValue, rowNumber, field);
      }
    });

    if (!submission.created_at) {
      throw new Error(`Row ${rowNumber}: Date is required.`);
    }

    return submission;
  });
}