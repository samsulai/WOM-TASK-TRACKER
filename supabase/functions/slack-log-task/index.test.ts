// Run with: deno test supabase/functions/slack-log-task/index.test.ts
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import {
  INTERNAL_VALUE,
  STATUS_OPTIONS,
  buildClientOptions,
  buildModalView,
  buildTaskInsertPayload,
  hmToHours,
  mondayOf,
  parseSubmission,
  resolveClientId,
} from './index.ts'

Deno.test('mondayOf: a Wednesday rolls back to that week\'s Monday', () => {
  assertEquals(mondayOf('2026-10-22'), '2026-10-19')
})

Deno.test('mondayOf: a Monday stays put', () => {
  assertEquals(mondayOf('2026-10-19'), '2026-10-19')
})

Deno.test('mondayOf: a Sunday rolls back to the Monday 6 days earlier', () => {
  assertEquals(mondayOf('2026-10-25'), '2026-10-19')
})

Deno.test('mondayOf: crosses a month boundary correctly', () => {
  assertEquals(mondayOf('2026-11-01'), '2026-10-26')
})

Deno.test('hmToHours: combines hours and minutes', () => {
  assertEquals(hmToHours(3, 10), 3 + 10 / 60)
})

Deno.test('hmToHours: missing/non-finite values default to zero', () => {
  assertEquals(hmToHours(NaN, 30), 0.5)
  assertEquals(hmToHours(2, NaN), 2)
})

Deno.test('buildClientOptions: Internal always comes first', () => {
  const options = buildClientOptions([{ id: 'c1', name: 'Overtime Marketing' }])
  assertEquals(options[0], { text: { type: 'plain_text', text: 'Internal' }, value: INTERNAL_VALUE })
  assertEquals(options[1], { text: { type: 'plain_text', text: 'Overtime Marketing' }, value: 'c1' })
})

Deno.test('buildClientOptions: no clients still returns just Internal', () => {
  assertEquals(buildClientOptions([]), [{ text: { type: 'plain_text', text: 'Internal' }, value: INTERNAL_VALUE }])
})

Deno.test('resolveClientId: the Internal sentinel maps to null', () => {
  assertEquals(resolveClientId(INTERNAL_VALUE), null)
})

Deno.test('resolveClientId: anything else passes through unchanged', () => {
  assertEquals(resolveClientId('c1'), 'c1')
})

Deno.test('buildModalView: has the right block ids for parseSubmission to match', () => {
  const view = buildModalView([{ id: 'c1', name: 'Overtime Marketing' }], '2026-10-22')
  const blockIds = view.blocks.map((b) => b.block_id)
  assertEquals(blockIds, ['client_block', 'project_block', 'date_block', 'status_block', 'hours_block', 'minutes_block'])
  assertEquals(view.callback_id, 'log_task_modal')
})

Deno.test('buildModalView: status defaults to the first status option', () => {
  const view = buildModalView([], '2026-10-22')
  const statusBlock = view.blocks.find((b) => b.block_id === 'status_block') as any
  assertEquals(statusBlock.element.initial_option.value, STATUS_OPTIONS[0])
})

const sampleValues = {
  client_block: { client_select: { selected_option: { value: 'c1' } } },
  project_block: { project_input: { value: 'Homepage redesign' } },
  date_block: { date_picker: { selected_date: '2026-10-22' } },
  status_block: { status_select: { selected_option: { value: 'In Progress' } } },
  hours_block: { hours_input: { value: '3' } },
  minutes_block: { minutes_input: { value: '10' } },
}

Deno.test('parseSubmission: extracts a flat object from the Slack state shape', () => {
  assertEquals(parseSubmission(sampleValues), {
    clientValue: 'c1',
    project: 'Homepage redesign',
    date: '2026-10-22',
    status: 'In Progress',
    hours: 3,
    minutes: 10,
  })
})

Deno.test('parseSubmission: missing/malformed shape returns null', () => {
  assertEquals(parseSubmission({}), null)
  assertEquals(parseSubmission(null), null)
})

Deno.test('parseSubmission: an empty project is treated as invalid', () => {
  assertEquals(parseSubmission({ ...sampleValues, project_block: { project_input: { value: '' } } }), null)
})

Deno.test('buildTaskInsertPayload: hours/minutes combine, created_at is noon UTC on the chosen date', () => {
  const payload = buildTaskInsertPayload({
    weekId: 'w1',
    project: '  Homepage redesign  ',
    status: 'In Progress',
    hours: 3,
    minutes: 10,
    date: '2026-10-22',
  })
  assertEquals(payload, {
    week_id: 'w1',
    project: 'Homepage redesign',
    status: 'In Progress',
    hours: 3 + 10 / 60,
    notes: '',
    done: false,
    created_at: '2026-10-22T12:00:00.000Z',
    verified: false,
  })
})

Deno.test('buildTaskInsertPayload: a Done status is reflected in done', () => {
  const payload = buildTaskInsertPayload({ weekId: 'w1', project: 'X', status: 'Done', hours: 1, minutes: 0, date: '2026-10-22' })
  assertEquals(payload.done, true)
})

Deno.test('buildTaskInsertPayload: always inserts as unverified, pending admin review', () => {
  const payload = buildTaskInsertPayload({ weekId: 'w1', project: 'X', status: 'Not Started', hours: 1, minutes: 0, date: '2026-10-22' })
  assertEquals(payload.verified, false)
})
