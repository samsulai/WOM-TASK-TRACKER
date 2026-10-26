// Run with: deno test supabase/functions/sheet-sync/index.test.ts
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import {
  buildBatchUpdateData,
  buildHoursLeftData,
  hoursLeftFor,
  hoursLeftValue,
  hoursToDayFraction,
  partitionSync,
  purchaseDescription,
  rowRanges,
  sheetDate,
  taskDescription,
  taskToRecord,
  purchaseToRecord,
} from './index.ts'

Deno.test('taskDescription: project only', () => {
  assertEquals(taskDescription({ project: 'Website', notes: '' }), 'Website')
})

Deno.test('taskDescription: notes only', () => {
  assertEquals(taskDescription({ project: '', notes: 'Fixed the footer' }), 'Fixed the footer')
})

Deno.test('taskDescription: both', () => {
  assertEquals(taskDescription({ project: 'Website', notes: 'Fixed the footer' }), 'Website — Fixed the footer')
})

Deno.test('taskDescription: neither', () => {
  assertEquals(taskDescription({ project: '', notes: '' }), '(no description)')
})

Deno.test('taskDescription: trims whitespace-only fields', () => {
  assertEquals(taskDescription({ project: '   ', notes: '  ' }), '(no description)')
})

Deno.test('purchaseDescription: whole number, no note', () => {
  assertEquals(purchaseDescription({ hours: 20, note: '' }), '20 hours bought')
})

Deno.test('purchaseDescription: fractional hours', () => {
  assertEquals(purchaseDescription({ hours: 7.5, note: '' }), '7.5 hours bought')
})

Deno.test('purchaseDescription: with a note', () => {
  assertEquals(purchaseDescription({ hours: 40, note: 'retainer top-up' }), '40 hours bought — retainer top-up')
})

Deno.test('sheetDate: formats as M/D/YYYY', () => {
  assertEquals(sheetDate('2026-10-05'), '10/5/2026')
})

Deno.test('taskToRecord: date comes from the task\'s own creation date, not a week', () => {
  const record = taskToRecord({ id: 't1', project: 'A', notes: '', hours: 6, createdAt: '2026-10-05T09:00:00.000Z' })
  assertEquals(record.date, '2026-10-05')
})

const task1 = taskToRecord({ id: 't1', project: 'A', notes: '', hours: 6, createdAt: '2026-10-05T09:00:00.000Z' })
const purchase1 = purchaseToRecord({ id: 'p1', purchasedOn: '2026-10-01', hours: 20, note: '', createdAt: '0' })

Deno.test('partitionSync: existing record keeps its tracked row', () => {
  const rowById = new Map([['t1', 7]])
  const plan = partitionSync([task1], rowById, 100)
  assertEquals(plan.toBlank, [])
  assertEquals(plan.toWrite, [{ row: 7, record: task1 }])
})

Deno.test('partitionSync: new record goes after the last row', () => {
  const plan = partitionSync([task1], new Map(), 100)
  assertEquals(plan.toBlank, [])
  assertEquals(plan.toWrite, [{ row: 101, record: task1 }])
})

Deno.test('partitionSync: multiple new records are ordered chronologically and placed in sequence', () => {
  const task2 = taskToRecord({ id: 't2', project: 'B', notes: '', hours: 4, createdAt: '2026-10-05T09:00:00.000Z' })
  const olderTask = taskToRecord({ id: 't1', project: 'A', notes: '', hours: 6, createdAt: '2026-09-28T09:00:00.000Z' })
  const plan = partitionSync([task2, olderTask], new Map(), 100)
  assertEquals(
    plan.toWrite.map((w) => w.row),
    [101, 102]
  )
  assertEquals(plan.toWrite[0].record.id, 't1') // older date first
  assertEquals(plan.toWrite[1].record.id, 't2')
})

Deno.test('partitionSync: a tracked row whose record is gone gets blanked', () => {
  const rowById = new Map([
    ['t1', 7],
    ['t2', 9],
  ])
  const plan = partitionSync([task1], rowById, 100)
  assertEquals(plan.toBlank, [9])
  assertEquals(plan.toWrite, [{ row: 7, record: task1 }])
})

Deno.test('partitionSync: tasks and purchases merge into one sorted, diffed list', () => {
  const rowById = new Map([['p1', 5]])
  const plan = partitionSync([task1, purchase1], rowById, 100)
  assertEquals(plan.toBlank, [])
  // purchase1 (2026-10-01) sorts before task1 (2026-10-05); purchase1 keeps
  // its tracked row 5, task1 is new and goes after lastRow.
  assertEquals(plan.toWrite, [
    { row: 5, record: purchase1 },
    { row: 101, record: task1 },
  ])
})

Deno.test('buildBatchUpdateData: header plus blank and write ranges', () => {
  const plan = { toBlank: [9], toWrite: [{ row: 7, record: task1 }] }
  const data = buildBatchUpdateData('Sheet1', plan)
  assertEquals(data[0], {
    range: "'Sheet1'!A1:E1",
    values: [['Date', 'Description', 'Hours Bought', 'Hours Spent', 'Total Hours Left']],
  })
  assertEquals(data[1], { range: "'Sheet1'!A9:B9", values: [['', '']] })
  assertEquals(data[2], { range: "'Sheet1'!C9:D9", values: [['', '']] })
  assertEquals(data[3], { range: "'Sheet1'!Z9", values: [['']] })
  assertEquals(data[4], { range: "'Sheet1'!A7:B7", values: [['10/5/2026', 'A']] })
  assertEquals(data[5], { range: "'Sheet1'!D7", values: [[6 / 24]] })
  assertEquals(data[6], { range: "'Sheet1'!Z7", values: [['t1']] })
})

Deno.test('buildBatchUpdateData: a purchase writes to column C, a task to column D', () => {
  const plan = {
    toBlank: [],
    toWrite: [
      { row: 7, record: purchase1 },
      { row: 8, record: task1 },
    ],
  }
  const data = buildBatchUpdateData('Sheet1', plan)
  assertEquals(data[1], { range: "'Sheet1'!A7:B7", values: [['10/1/2026', '20 hours bought']] })
  assertEquals(data[2], { range: "'Sheet1'!C7", values: [[20 / 24]] })
  assertEquals(data[3], { range: "'Sheet1'!Z7", values: [['p1']] })
  assertEquals(data[4], { range: "'Sheet1'!A8:B8", values: [['10/5/2026', 'A']] })
  assertEquals(data[5], { range: "'Sheet1'!D8", values: [[6 / 24]] })
  assertEquals(data[6], { range: "'Sheet1'!Z8", values: [['t1']] })
})

Deno.test('hoursToDayFraction: converts hours to a fraction of a day', () => {
  assertEquals(hoursToDayFraction(6), 0.25)
  assertEquals(hoursToDayFraction(12), 0.5)
})

Deno.test('hoursToDayFraction: missing or zero hours is zero', () => {
  assertEquals(hoursToDayFraction(''), 0)
  assertEquals(hoursToDayFraction(0), 0)
})

Deno.test('rowRanges: collapses consecutive rows into one run', () => {
  assertEquals(rowRanges([7, 8, 9]), [{ start: 7, end: 9 }])
})

Deno.test('rowRanges: keeps non-consecutive rows as separate runs', () => {
  assertEquals(rowRanges([7, 9, 10, 15]), [
    { start: 7, end: 7 },
    { start: 9, end: 10 },
    { start: 15, end: 15 },
  ])
})

Deno.test('rowRanges: de-dupes and sorts unordered input', () => {
  assertEquals(rowRanges([10, 7, 8, 8, 7]), [{ start: 7, end: 8 }, { start: 10, end: 10 }])
})

Deno.test('rowRanges: empty input yields no runs', () => {
  assertEquals(rowRanges([]), [])
})

Deno.test('hoursLeftFor: purchases minus tasks', () => {
  assertEquals(hoursLeftFor([task1, purchase1]), 20 - 6)
})

Deno.test('hoursLeftFor: can go negative when over budget', () => {
  const bigTask = taskToRecord({ id: 't2', project: 'A', notes: '', hours: 30, createdAt: '2026-10-06T09:00:00.000Z' })
  assertEquals(hoursLeftFor([bigTask, purchase1]), 20 - 30)
})

Deno.test('hoursLeftFor: empty records is zero', () => {
  assertEquals(hoursLeftFor([]), 0)
})

Deno.test('buildHoursLeftData: clears up to clearUpToRow, writes a non-negative balance as a day-fraction', () => {
  const data = buildHoursLeftData('Sheet1', 4, 4, 14)
  assertEquals(data, [
    { range: "'Sheet1'!E2:E4", values: [[''], [''], ['']] },
    { range: "'Sheet1'!E4", values: [[14 / 24]] },
  ])
})

Deno.test('buildHoursLeftData: clears further than writeRow when a stale total sits beyond it', () => {
  // writeRow (3) shrank back below a previous sync's leftover total at row
  // 5 -- clearUpToRow must still reach row 5 to wipe it out.
  const data = buildHoursLeftData('Sheet1', 5, 3, 7)
  assertEquals(data, [
    { range: "'Sheet1'!E2:E5", values: [[''], [''], [''], ['']] },
    { range: "'Sheet1'!E3", values: [[7 / 24]] },
  ])
})

Deno.test('buildHoursLeftData: a negative (over-budget) balance is written as a plain number, not a day-fraction', () => {
  const data = buildHoursLeftData('Sheet1', 2, 2, -10)
  assertEquals(data, [
    { range: "'Sheet1'!E2:E2", values: [['']] },
    { range: "'Sheet1'!E2", values: [[-10]] },
  ])
})

Deno.test('hoursLeftValue: non-negative converts to a day-fraction', () => {
  assertEquals(hoursLeftValue(14), 14 / 24)
  assertEquals(hoursLeftValue(0), 0)
})

Deno.test('hoursLeftValue: negative stays a plain number', () => {
  assertEquals(hoursLeftValue(-10), -10)
})

Deno.test('buildHoursLeftData: no records left -- clears but writes nothing', () => {
  assertEquals(buildHoursLeftData('Sheet1', 3, null, 0), [{ range: "'Sheet1'!E2:E3", values: [[''], ['']] }])
})

Deno.test('buildHoursLeftData: no data rows at all yields nothing', () => {
  assertEquals(buildHoursLeftData('Sheet1', 1, null, 0), [])
})
