type DatePart = 'day' | 'month' | 'year';

const DATE_PART_ORDER: readonly DatePart[] = ['day', 'month', 'year'];
const DATE_SEPARATOR = '.';
const DATE_PART_LENGTHS: Readonly<Record<DatePart, number>> = { day: 2, month: 2, year: 4 };
const DATE_PART_PLACEHOLDERS: Readonly<Record<DatePart, string>> = {
  day: 'dd',
  month: 'mm',
  year: 'yyyy',
};

export const DATE_TEXT_PLACEHOLDER = DATE_PART_ORDER.map(
  (part) => DATE_PART_PLACEHOLDERS[part],
).join(DATE_SEPARATOR);

function readDatePart({
  textParts,
  part,
}: Readonly<{ textParts: readonly string[]; part: DatePart }>): string {
  const datePart = textParts[DATE_PART_ORDER.indexOf(part)] ?? '';
  return datePart;
}

export function toDateText(isoDate: string): string {
  const [year = '', month = '', day = ''] = isoDate.split('-');
  const dateParts: Readonly<Record<DatePart, string>> = { day, month, year };
  const dateText = DATE_PART_ORDER.map((part) => dateParts[part]).join(DATE_SEPARATOR);
  return dateText;
}

export function readIsoDate(dateText: string): string | undefined {
  const textParts = dateText.trim().split(DATE_SEPARATOR);
  const isWellFormed =
    textParts.length === DATE_PART_ORDER.length &&
    DATE_PART_ORDER.every((part) =>
      new RegExp(`^\\d{${String(DATE_PART_LENGTHS[part])}}$`).test(
        readDatePart({ textParts, part }),
      ),
    );
  if (!isWellFormed) {
    return undefined;
  }

  const isoDate = [
    readDatePart({ textParts, part: 'year' }),
    readDatePart({ textParts, part: 'month' }),
    readDatePart({ textParts, part: 'day' }),
  ].join('-');
  const date = new Date(`${isoDate}T00:00:00Z`);
  const isRealDate = !Number.isNaN(date.getTime()) && date.toISOString().startsWith(isoDate);
  return isRealDate ? isoDate : undefined;
}

export function maskDateText(typedText: string): string {
  const digitCount = DATE_PART_ORDER.reduce((sum, part) => sum + DATE_PART_LENGTHS[part], 0);
  const digits = typedText.replace(/\D/g, '').slice(0, digitCount);
  const dateText = DATE_PART_ORDER.map((part, index) => {
    const start = DATE_PART_ORDER.slice(0, index).reduce(
      (sum, previousPart) => sum + DATE_PART_LENGTHS[previousPart],
      0,
    );
    return digits.slice(start, start + DATE_PART_LENGTHS[part]);
  })
    .filter((part) => part !== '')
    .join(DATE_SEPARATOR);
  return dateText;
}
