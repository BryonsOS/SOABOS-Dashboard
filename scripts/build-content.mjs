import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'
import { buildPool } from './pool-engine.mjs'

const root = process.cwd()
const contentDir = path.join(root, 'content')
const outputDirs = [
  path.join(root, 'dist', 'generated'),
  path.join(root, 'generated'),
  path.join(root, 'public', 'generated')
]

for (const dir of outputDirs) {
  fs.mkdirSync(dir, { recursive: true })
}

const dashboard = JSON.parse(fs.readFileSync(path.join(contentDir, 'dashboard.json'), 'utf8'))
const current = readMarkdown(path.join(contentDir, 'now', 'current.md'))
const projects = readCollection(path.join(contentDir, 'projects'))
const goals = readCollection(path.join(contentDir, 'goals'))
const areas = readCollection(path.join(contentDir, 'areas'))
const updates = readCollection(path.join(contentDir, 'updates'))
const birthdays = readJson(path.join(contentDir, 'birthdays.json'))
const gratitude = readJson(path.join(contentDir, 'gratitude.json'))
const events = readJson(path.join(contentDir, 'events.json'))
const fitness = readJson(path.join(contentDir, 'fitness.json'))
const warRoom = readJson(path.join(contentDir, 'war-room.json'))
const pool = readJson(path.join(contentDir, 'pool.json'))

const computedStats = {
  projects: projects.length,
  goals: goals.length,
  status: dashboard.stats?.status || inferOverallStatus(projects, goals)
}

const bundleGeneratedAt = new Date().toISOString()
const buildId = Date.now()

const bundle = {
  meta: {
    generatedAt: bundleGeneratedAt,
    buildId
  },
  dashboard: {
    ...dashboard,
    stats: computedStats
  },
  current,
  projects,
  goals,
  areas,
  updates,
  birthdays: buildBirthdays(birthdays),
  gratitude,
  events,
  fitness,
  warRoom,
  pool: buildPool(pool)
}

for (const dir of outputDirs) {
  fs.writeFileSync(path.join(dir, 'content.json'), JSON.stringify(bundle, null, 2))
}

function readCollection(dir) {
  return fs.readdirSync(dir)
    .filter((file) => file.endsWith('.md'))
    .sort()
    .map((file) => readMarkdown(path.join(dir, file)))
}

function readMarkdown(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8')
  const parsed = matter(raw)
  return {
    data: parsed.data,
    content: parsed.content.trim()
  }
}

function inferOverallStatus(projects, goals) {
  const values = [...projects, ...goals].map((item) => String(item.data.status || '').toLowerCase())

  if (values.includes('blocked')) return 'Blocked'
  if (values.includes('active')) return 'Active'
  if (values.includes('queued')) return 'Queued'
  if (values.includes('paused')) return 'Paused'
  if (values.length && values.every((value) => value === 'complete')) return 'Complete'
  return 'Building'
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function buildBirthdays(source = {}) {
  const lookaheadDays = Number(source.settings?.lookaheadDays || 30)
  const todayStart = startOfEasternDay(new Date())
  const people = Array.isArray(source.people) ? source.people : []

  const upcoming = []
  const needsInfo = []

  for (const person of people) {
    const month = Number(person.month)
    const day = Number(person.day)
    const hasMonthDay = Number.isInteger(month) && Number.isInteger(day) && month >= 1 && month <= 12 && day >= 1 && day <= 31

    if (!hasMonthDay) {
      needsInfo.push({
        ...person,
        missing: missingFields(person)
      })
      continue
    }

    const nextBirthday = getNextBirthday(todayStart, month, day)
    const daysAway = Math.round((nextBirthday - todayStart) / 86400000)
    const year = Number(person.year)
    const hasYear = Number.isInteger(year) && year > 1900
    const age = hasYear ? nextBirthday.getFullYear() - year : null

    const normalized = {
      ...person,
      dateLabel: formatMonthDayParts(month, day),
      daysAway,
      age,
      urgency: daysAway <= 7 ? 'soon' : 'upcoming',
      sortKey: `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    }

    if (!hasYear) {
      needsInfo.push({
        ...normalized,
        missing: missingFields(person)
      })
    }

    if (daysAway <= lookaheadDays) {
      upcoming.push(normalized)
    }
  }

  upcoming.sort((a, b) => a.daysAway - b.daysAway || a.name.localeCompare(b.name))
  needsInfo.sort((a, b) => a.name.localeCompare(b.name))

  return {
    settings: {
      lookaheadDays,
      title: source.settings?.title || 'Upcoming Birthdays',
      subtitle: source.settings?.subtitle || 'People coming up soon and birthdays that still need details.'
    },
    upcoming,
    needsInfo,
    summary: {
      upcomingCount: upcoming.length,
      needsInfoCount: needsInfo.length
    }
  }
}

function getNextBirthday(today, month, day) {
  let year = today.getFullYear()
  let candidate = new Date(year, month - 1, day)

  if (
    candidate.getMonth() !== month - 1 ||
    candidate.getDate() !== day ||
    candidate < today
  ) {
    year += 1
    candidate = new Date(year, month - 1, day)
  }

  return candidate
}

function formatMonthDayParts(month, day) {
  const ref = new Date(2000, month - 1, day)
  return ref.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  })
}

function startOfEasternDay(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date)

  const year = Number(parts.find((part) => part.type === 'year')?.value)
  const month = Number(parts.find((part) => part.type === 'month')?.value)
  const day = Number(parts.find((part) => part.type === 'day')?.value)
  return new Date(year, month - 1, day)
}

function missingFields(person = {}) {
  const missing = []
  if (!Number.isInteger(Number(person.month)) || !Number.isInteger(Number(person.day))) {
    missing.push('date')
  }
  if (!Number.isInteger(Number(person.year)) || Number(person.year) <= 1900) {
    missing.push('birth year')
  }
  return missing
}
