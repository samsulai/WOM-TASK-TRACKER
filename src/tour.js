import { driver } from 'driver.js'
import 'driver.js/dist/driver.css'

const TOUR_SEEN_KEY = 'wtt-tour-seen'

function adminSteps() {
  return [
    {
      element: '.topbar-brand',
      popover: {
        title: 'Welcome 👋',
        description:
          'This is your Weekly Task Tracker. Log hours by week, and — since you\'re on your own admin link — manage clients too.',
      },
    },
    {
      element: '.stats-bar',
      popover: {
        title: 'Quick stats',
        description: 'Weeks logged, tasks open vs. done, and total hours — always for whatever\'s currently in view.',
      },
    },
    {
      element: '.totals-card',
      popover: {
        title: 'Hours by project',
        description: 'A running breakdown of hours per project, with the bar showing the split at a glance.',
      },
    },
    {
      element: '.week-nav-panel',
      popover: {
        title: 'Every week, one place',
        description:
          'Click any week to jump to it. When weeks from different clients are mixed together, each one shows a small tag telling you who it belongs to.',
      },
    },
    {
      element: '.week-client-select',
      popover: {
        title: 'Assign a week to a client',
        description:
          'Every week belongs to exactly one owner — pick a client here, or leave it "Internal" if it\'s just your own tracking.',
      },
    },
    {
      element: '.task-table',
      popover: {
        title: 'Log the work',
        description: 'Project, status, hours, notes, done — edit any field directly, it saves automatically.',
      },
    },
    {
      element: '.add-week-btn',
      popover: {
        title: 'Add a week',
        description: 'Start a new week whenever you need one.',
      },
    },
    {
      element: '#tour-clients-btn',
      popover: {
        title: 'Manage clients',
        description:
          'Add clients and copy their shareable link here. Click a client\'s name (not the icons) to filter your own view down to just their data — no data changes, just what you\'re looking at.',
      },
    },
    {
      element: '#tour-export-btn',
      popover: {
        title: 'Export CSV',
        description: 'Download logged hours as a spreadsheet, optionally filtered to one month with the picker next to it.',
      },
    },
    {
      element: '.theme-toggle',
      popover: {
        title: 'Light or dark',
        description: 'Switch themes any time — it remembers your choice.',
      },
    },
  ]
}

function clientSteps() {
  return [
    {
      element: '.topbar-brand',
      popover: {
        title: 'Welcome 👋',
        description: 'This is a live view of your hours. Everything here is scoped to just your own data.',
      },
    },
    {
      element: '.stats-bar',
      popover: {
        title: 'Quick stats',
        description: 'Weeks logged, tasks open vs. done, and total hours.',
      },
    },
    {
      element: '.totals-card',
      popover: {
        title: 'Hours by project',
        description: 'A running breakdown of hours per project.',
      },
    },
    {
      element: '.week-nav-panel',
      popover: {
        title: 'Your weeks',
        description: 'Click any week to jump to it — the current one is marked "This week".',
      },
    },
    {
      element: '.task-table',
      popover: {
        title: 'The work logged',
        description: 'Project, status, hours, notes, done — this updates live as it\'s logged, but it\'s view-only here.',
      },
    },
    {
      element: '.add-week-btn',
      popover: {
        title: 'Add a week',
        description: 'Start a new week whenever you need one.',
      },
    },
    {
      element: '#tour-export-btn',
      popover: {
        title: 'Export CSV',
        description: 'Download your logged hours as a spreadsheet, optionally filtered to one month.',
      },
    },
    {
      element: '.theme-toggle',
      popover: {
        title: 'Light or dark',
        description: 'Switch themes any time — it remembers your choice.',
      },
    },
  ]
}

export function startTour(isAdmin) {
  const steps = (isAdmin ? adminSteps() : clientSteps()).filter((step) =>
    document.querySelector(step.element)
  )
  if (steps.length === 0) return

  const tour = driver({
    showProgress: true,
    allowClose: true,
    overlayColor: 'rgba(0, 0, 0, 0.6)',
    popoverClass: 'wtt-tour-popover',
    steps,
  })
  tour.drive()
}

export function maybeAutoStartTour(isAdmin) {
  try {
    if (localStorage.getItem(TOUR_SEEN_KEY)) return
    localStorage.setItem(TOUR_SEEN_KEY, '1')
  } catch {
    // localStorage unavailable -- just don't auto-start, manual trigger still works
    return
  }
  startTour(isAdmin)
}
