// Builds the sheets for the Excel export. Kept separate (and free of React /
// DOM) so the same layout can be reused when the weekly report email attaches
// a spreadsheet.

const HEADER = { fontWeight: 'bold', backgroundColor: '#14173a', textColor: '#ffffff' }
const TOTAL = { fontWeight: 'bold', backgroundColor: '#eef2ff' }
const HOURS_FORMAT = '0.00'

const headerRow = (labels) => labels.map((value) => ({ value, ...HEADER }))

function sumBy(rows, keyOf) {
  const map = new Map()
  for (const r of rows) {
    const key = keyOf(r) || '(none)'
    const entry = map.get(key) || { hours: 0, tasks: 0, done: 0 }
    entry.hours += Number(r.hours || 0)
    entry.tasks += 1
    if (r.done) entry.done += 1
    map.set(key, entry)
  }
  return [...map.entries()].sort((a, b) => b[1].hours - a[1].hours)
}

function summarySheet(name, firstHeader, groups, totalHours) {
  const data = [
    headerRow([firstHeader, 'Hours', 'Tasks', 'Done']),
    ...groups.map(([label, g]) => [
      label,
      { value: g.hours, format: HOURS_FORMAT },
      g.tasks,
      g.done,
    ]),
    [
      { value: 'Total', ...TOTAL },
      { value: totalHours, format: HOURS_FORMAT, ...TOTAL },
      { value: groups.reduce((n, [, g]) => n + g.tasks, 0), ...TOTAL },
      { value: groups.reduce((n, [, g]) => n + g.done, 0), ...TOTAL },
    ],
  ]
  return { data, sheet: name, columns: [{ width: 30 }, { width: 10 }, { width: 8 }, { width: 8 }], stickyRowsCount: 1 }
}

// rows: [{ client, weekStart 'YYYY-MM-DD', weekLabel, project, status, hours, notes, done }]
export function buildSheets(rows) {
  const totalHours = rows.reduce((sum, r) => sum + Number(r.hours || 0), 0)

  const tasks = [
    headerRow(['Client', 'Week start', 'Week label', 'Project', 'Status', 'Hours', 'Notes', 'Done']),
    ...rows.map((r) => [
      r.client,
      { value: new Date(`${r.weekStart}T00:00:00Z`), type: Date, format: 'yyyy-mm-dd' },
      r.weekLabel || null,
      r.project || null,
      r.status,
      { value: Number(r.hours || 0), format: HOURS_FORMAT },
      r.notes || null,
      r.done ? 'Yes' : 'No',
    ]),
    [
      { value: 'Total', ...TOTAL },
      { value: null, ...TOTAL },
      { value: null, ...TOTAL },
      { value: null, ...TOTAL },
      { value: null, ...TOTAL },
      { value: totalHours, format: HOURS_FORMAT, ...TOTAL },
      { value: null, ...TOTAL },
      { value: null, ...TOTAL },
    ],
  ]

  const sheets = [
    {
      data: tasks,
      sheet: 'Tasks',
      columns: [{ width: 22 }, { width: 12 }, { width: 20 }, { width: 26 }, { width: 13 }, { width: 9 }, { width: 44 }, { width: 7 }],
      stickyRowsCount: 1,
    },
    summarySheet('By project', 'Project', sumBy(rows, (r) => r.project.trim()), totalHours),
  ]
  const byClient = sumBy(rows, (r) => r.client)
  if (byClient.length > 1) sheets.push(summarySheet('By client', 'Client', byClient, totalHours))
  return sheets
}

export async function buildXlsxBlob(rows) {
  // Loaded on demand so the spreadsheet library isn't part of the main bundle.
  const { default: writeXlsxFile } = await import('write-excel-file/browser')
  return writeXlsxFile(buildSheets(rows)).toBlob()
}
