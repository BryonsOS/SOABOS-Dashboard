import fs from 'node:fs'
import path from 'node:path'
import { buildPool } from './pool-engine.mjs'

const root = process.cwd()
const poolPath = path.join(root, 'content', 'pool.json')

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, ...rest] = arg.replace(/^--/, '').split('=')
    return [key, rest.join('=')]
  })
)

if ('help' in args || !Object.keys(args).length) {
  usage()
  process.exit(0)
}

const pool = JSON.parse(fs.readFileSync(poolPath, 'utf8'))
pool.entrants = Array.isArray(pool.entrants) ? pool.entrants : []
pool.weeks = Array.isArray(pool.weeks) ? pool.weeks : []

const validTeams = new Set(pool.teams.map((team) => String(team.abbr).toUpperCase()))
const changes = []

if (args['add-entrant']) {
  for (const name of splitList(args['add-entrant'])) {
    const id = slugify(name)
    if (pool.entrants.some((entrant) => entrant.id === id)) {
      fail(`Entrant "${name}" (${id}) already exists.`)
    }
    pool.entrants.push({ id, name, role: null, paid: args.paid !== 'false' })
    changes.push(`added entrant ${name} (${id})`)
  }
}

if (args['remove-entrant']) {
  for (const token of splitList(args['remove-entrant'])) {
    const id = resolveEntrantId(token)
    pool.entrants = pool.entrants.filter((entrant) => entrant.id !== id)
    for (const week of pool.weeks) delete week.picks?.[id]
    changes.push(`removed entrant ${id}`)
  }
}

const weekNumber = args.week ? Number(args.week) : null
if (args.pick || args.result || args.status || args.deadline) {
  if (!Number.isInteger(weekNumber) || weekNumber < 1) {
    fail('--week=<n> is required when setting --pick, --result, --status, or --deadline.')
  }
}

const week = weekNumber ? getWeek(weekNumber) : null

if (args.pick) {
  for (const entry of splitList(args.pick)) {
    const [who, team] = entry.split(':').map((part) => part?.trim())
    if (!who || !team) fail(`Bad --pick value "${entry}". Use --pick=name:TEAM`)
    const id = resolveEntrantId(who)
    const abbr = team.toUpperCase()
    if (abbr !== 'BYE' && !validTeams.has(abbr)) fail(`Unknown team "${team}".`)
    week.picks[id] = abbr
    changes.push(`week ${week.week}: ${id} picked ${abbr}`)
  }
}

if (args['clear-pick']) {
  for (const who of splitList(args['clear-pick'])) {
    const id = resolveEntrantId(who)
    delete week.picks[id]
    changes.push(`week ${week.week}: cleared pick for ${id}`)
  }
}

if (args.result) {
  for (const entry of splitList(args.result)) {
    const [team, outcome] = entry.split(':').map((part) => part?.trim().toLowerCase())
    if (!team || !outcome) fail(`Bad --result value "${entry}". Use --result=TEAM:win`)
    const abbr = team.toUpperCase()
    if (!validTeams.has(abbr)) fail(`Unknown team "${team}".`)
    if (!['win', 'loss', 'tie'].includes(outcome)) fail(`Result must be win, loss, or tie — got "${outcome}".`)
    week.results[abbr] = outcome
    changes.push(`week ${week.week}: ${abbr} ${outcome}`)
  }
}

if (args.status) {
  if (!['final', 'open', 'upcoming'].includes(args.status)) {
    fail(`--status must be final, open, or upcoming — got "${args.status}".`)
  }
  week.status = args.status
  changes.push(`week ${week.week}: status ${args.status}`)

  if (args.status === 'final') {
    const next = pool.weeks.find((item) => item.week === week.week + 1)
    if (next && next.status === 'upcoming') {
      next.status = 'open'
      changes.push(`week ${next.week}: status open`)
    }
  }
}

if (args.deadline) {
  week.deadline = new Date(args.deadline).toISOString()
  changes.push(`week ${week.week}: deadline ${week.deadline}`)
}

for (const [key, value] of Object.entries(args)) {
  if (!key.startsWith('set-')) continue
  const field = key.slice(4)
  pool.settings[field] = coerce(value)
  changes.push(`settings.${field} = ${JSON.stringify(pool.settings[field])}`)
}

if (!changes.length) {
  console.log('Nothing to do. Run with --help for usage.')
  process.exit(0)
}

pool.weeks.sort((a, b) => a.week - b.week)
fs.writeFileSync(poolPath, `${JSON.stringify(pool, null, 2)}\n`)

for (const change of changes) console.log(`· ${change}`)

const computed = buildPool(pool)
console.log(`\n${computed.settings.title} — Week ${computed.summary.currentWeek ?? '—'} (${computed.summary.currentWeekStatus})`)
console.log(`${computed.summary.aliveCount} alive · ${computed.summary.eliminatedCount} eliminated · pot ${computed.summary.potLabel}`)
if (computed.summary.championName) console.log(`Champion: ${computed.summary.championName}`)

for (const warning of computed.warnings) console.warn(`! ${warning.message}`)
console.log('\nRun `npm run build` to publish the updated board.')

function getWeek(number) {
  let found = pool.weeks.find((item) => Number(item.week) === number)
  if (!found) {
    found = { week: number, deadline: null, status: 'upcoming', picks: {}, results: {} }
    pool.weeks.push(found)
  }
  found.picks = found.picks || {}
  found.results = found.results || {}
  return found
}

function resolveEntrantId(token) {
  const needle = String(token).trim().toLowerCase()
  const match = pool.entrants.find((entrant) =>
    entrant.id.toLowerCase() === needle || String(entrant.name).toLowerCase() === needle)
  if (!match) fail(`Unknown entrant "${token}". Add them first with --add-entrant="${token}".`)
  return match.id
}

function splitList(value) {
  return String(value).split(',').map((part) => part.trim()).filter(Boolean)
}

function slugify(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'entrant'
}

function coerce(value) {
  if (value === 'true') return true
  if (value === 'false') return false
  if (value !== '' && !Number.isNaN(Number(value))) return Number(value)
  return value
}

function fail(message) {
  console.error(`Error: ${message}`)
  process.exit(1)
}

function usage() {
  console.log(`Survivor pool commissioner tool

  npm run pool -- --add-entrant="Mike Ross,Sara P"
  npm run pool -- --remove-entrant="Mike Ross"

  npm run pool -- --week=1 --pick="Bryon:DET,Mike Ross:KC"
  npm run pool -- --week=1 --clear-pick="Bryon"
  npm run pool -- --week=1 --result="DET:win,KC:loss,GB:tie"
  npm run pool -- --week=1 --status=final        # also opens week 2
  npm run pool -- --week=2 --deadline=2026-09-20T17:00:00Z

  npm run pool -- --set-strikesToEliminate=1     # switch to single elimination
  npm run pool -- --set-byeWeeksPerPlayer=1
  npm run pool -- --set-allowBuyBacks=true --set-buyBackFee=25

Results are per team, so one --result list grades everyone who picked that team.
Follow any change with \`npm run build\` to publish.`)
}
