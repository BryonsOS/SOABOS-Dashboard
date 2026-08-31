const BYE_PICK = 'BYE'

export function buildPool(source = {}) {
  const settings = normalizeSettings(source.settings)
  const teams = normalizeTeams(source.teams)
  const teamByAbbr = new Map(teams.map((team) => [team.abbr, team]))
  const entrants = normalizeEntrants(source.entrants)
  const weeks = normalizeWeeks(source.weeks, settings.totalWeeks)
  const warnings = []

  const ledger = new Map(entrants.map((entrant) => [entrant.id, createLedger(entrant, settings, teams.length)]))

  for (const week of weeks) {
    for (const [entrantId, rawPick] of Object.entries(week.picks)) {
      if (!ledger.has(entrantId)) {
        warnings.push(warn('unknown-entrant', `Week ${week.week} has a pick for unknown entrant "${entrantId}".`))
      }
    }

    for (const abbr of Object.keys(week.results)) {
      if (!teamByAbbr.has(abbr)) {
        warnings.push(warn('unknown-team', `Week ${week.week} has a result for unknown team "${abbr}".`))
      }
    }

    for (const entrant of entrants) {
      const record = ledger.get(entrant.id)
      const pick = week.picks[entrant.id] ?? null
      const graded = gradePick({ week, pick, record, settings, teamByAbbr, warnings })
      record.history.push(graded)

      if (graded.burnsTeam) record.teamsUsed.push(graded.pick)
      if (graded.usesBye) record.byesUsed += 1
      if (graded.strike) record.strikes += 1
      if (graded.counted) record.weeksSurvived = week.week

      if (record.status === 'alive' && record.strikes >= settings.strikesToEliminate) {
        record.status = 'eliminated'
        record.eliminatedWeek = week.week
      }
    }
  }

  const standings = entrants.map((entrant) => finalizeEntrant(ledger.get(entrant.id), settings, teams.length, weeks, teamByAbbr))
  const alive = standings.filter((item) => item.status === 'alive')
  const eliminated = standings.filter((item) => item.status === 'eliminated')

  const gradedWeeks = weeks.filter((week) => week.status === 'final')
  const champion = alive.length === 1 && gradedWeeks.length ? alive[0] : null
  if (champion) champion.status = 'winner'

  const currentWeek = pickCurrentWeek(weeks)
  const weekCards = weeks.map((week) => summarizeWeek(week, standings, teamByAbbr, currentWeek))
  const teamUsage = buildTeamUsage(teams, standings, currentWeek, weeks)

  return {
    settings,
    summary: {
      entrantsTotal: standings.length,
      aliveCount: champion ? 1 : alive.length,
      eliminatedCount: eliminated.length,
      weeksPlayed: gradedWeeks.length,
      weeksRemaining: Math.max(0, weeks.length - gradedWeeks.length),
      currentWeek: currentWeek?.week ?? null,
      currentWeekStatus: currentWeek?.status ?? 'upcoming',
      currentWeekDeadline: currentWeek?.deadline ?? null,
      picksIn: currentWeek ? countPicks(currentWeek, standings) : 0,
      picksNeeded: currentWeek ? alive.length : 0,
      potLabel: formatMoney(settings.entryFee * standings.length, settings.currency),
      formatLabel: settings.strikesToEliminate > 1
        ? `Double elimination · ${settings.strikesToEliminate} strikes`
        : 'Single elimination',
      championName: champion ? champion.name : null
    },
    rules: buildRules(settings, teams.length),
    standings: sortStandings(standings),
    alive: sortStandings(alive),
    eliminated: sortStandings(eliminated),
    weeks: weekCards,
    currentWeek: weekCards.find((week) => week.isCurrent) || null,
    teams,
    teamUsage,
    warnings
  }
}

function createLedger(entrant, settings) {
  return {
    ...entrant,
    status: 'alive',
    strikes: 0,
    eliminatedWeek: null,
    teamsUsed: [],
    byesUsed: 0,
    weeksSurvived: 0,
    history: []
  }
}

function gradePick({ week, pick, record, settings, teamByAbbr, warnings }) {
  const base = {
    week: week.week,
    pick: pick || null,
    teamName: null,
    outcome: 'none',
    label: '—',
    strike: false,
    burnsTeam: false,
    usesBye: false,
    counted: false
  }

  if (record.status !== 'alive') {
    return { ...base, outcome: 'out', label: 'Out' }
  }

  if (pick === BYE_PICK) {
    const byesLeft = settings.byeWeeksPerPlayer - record.byesUsed
    if (settings.byeWeeksPerPlayer > 0 && byesLeft > 0) {
      return { ...base, outcome: 'bye', label: 'BYE used', usesBye: true, counted: week.status === 'final' }
    }
    warnings.push(warn('bye-not-available', `Week ${week.week}: ${record.name} took a BYE but has none left.`))
    return { ...base, outcome: 'strike', label: 'No BYE left · strike', strike: week.status === 'final' }
  }

  if (!pick) {
    if (week.status !== 'final') {
      return { ...base, outcome: 'awaiting', label: 'No pick yet' }
    }
    if (settings.missedPickPolicy === 'strike') {
      warnings.push(warn('missed-pick', `Week ${week.week}: ${record.name} missed the deadline and took a strike.`))
      return { ...base, outcome: 'missed', label: 'Missed pick · strike', strike: true }
    }
    return { ...base, outcome: 'missed', label: 'Missed pick' }
  }

  const team = teamByAbbr.get(pick)
  if (!team) {
    warnings.push(warn('unknown-team', `Week ${week.week}: ${record.name} picked unknown team "${pick}".`))
    return { ...base, outcome: 'invalid', label: `Unknown team ${pick}` }
  }

  if (record.teamsUsed.includes(pick)) {
    warnings.push(warn('duplicate-team', `Week ${week.week}: ${record.name} picked ${team.name} again — teams are one-time use. Commissioner action needed.`))
    return { ...base, teamName: team.name, outcome: 'duplicate', label: `${team.name} already used` }
  }

  const result = week.results[pick] || null

  if (!result) {
    return { ...base, teamName: team.name, outcome: 'pending', label: `${team.name} · pending`, burnsTeam: week.status === 'final' }
  }

  if (result === 'win') {
    return { ...base, teamName: team.name, outcome: 'win', label: `${team.name} won`, burnsTeam: true, counted: true }
  }

  if (result === 'tie') {
    const isLoss = settings.tieCountsAs === 'loss'
    return {
      ...base,
      teamName: team.name,
      outcome: 'tie',
      label: `${team.name} tied · ${isLoss ? 'strike' : 'survived'}`,
      burnsTeam: true,
      strike: isLoss,
      counted: !isLoss
    }
  }

  return { ...base, teamName: team.name, outcome: 'loss', label: `${team.name} lost · strike`, burnsTeam: true, strike: true }
}

function finalizeEntrant(record, settings, teamCount, weeks, teamByAbbr) {
  const openWeek = pickCurrentWeek(weeks)
  const currentEntry = openWeek ? record.history.find((item) => item.week === openWeek.week) : null
  const lastGraded = [...record.history].reverse().find((item) => ['win', 'loss', 'tie', 'missed', 'bye'].includes(item.outcome)) || null

  return {
    id: record.id,
    name: record.name,
    role: record.role || null,
    paid: record.paid !== false,
    status: record.status,
    strikes: record.strikes,
    strikesRemaining: Math.max(0, settings.strikesToEliminate - record.strikes),
    strikesToEliminate: settings.strikesToEliminate,
    eliminatedWeek: record.eliminatedWeek,
    weeksSurvived: record.weeksSurvived,
    teamsUsed: record.teamsUsed.map((abbr) => ({ abbr, name: teamByAbbr.get(abbr)?.name || abbr })),
    teamsUsedCount: record.teamsUsed.length,
    teamsRemaining: Math.max(0, teamCount - record.teamsUsed.length),
    byesUsed: record.byesUsed,
    byesRemaining: Math.max(0, settings.byeWeeksPerPlayer - record.byesUsed),
    currentPick: currentEntry && currentEntry.pick ? currentEntry.pick : null,
    currentPickLabel: currentEntry ? currentEntry.label : 'No pick yet',
    lastOutcome: lastGraded ? lastGraded.outcome : null,
    lastOutcomeLabel: lastGraded ? `Week ${lastGraded.week} · ${lastGraded.label}` : 'Has not played a graded week yet.',
    statusLabel: buildStatusLabel(record, settings),
    history: record.history.filter((item) => item.outcome !== 'none')
  }
}

function buildStatusLabel(record, settings) {
  if (record.status === 'eliminated') return `Eliminated · Week ${record.eliminatedWeek}`
  const left = settings.strikesToEliminate - record.strikes
  if (record.strikes === 0) return 'Alive · clean sheet'
  return `Alive · ${record.strikes} strike${record.strikes === 1 ? '' : 's'} · ${left} to spare`
}

function summarizeWeek(week, standings, teamByAbbr, currentWeek) {
  const entries = Object.entries(week.picks).filter(([, pick]) => Boolean(pick))
  const counts = new Map()

  for (const [, pick] of entries) {
    if (pick === BYE_PICK) continue
    counts.set(pick, (counts.get(pick) || 0) + 1)
  }

  const popular = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([abbr, count]) => ({ abbr, name: teamByAbbr.get(abbr)?.name || abbr, count }))

  const graded = standings.flatMap((entrant) => entrant.history.filter((item) => item.week === week.week))
  const survivors = graded.filter((item) => ['win', 'bye'].includes(item.outcome) || (item.outcome === 'tie' && !item.strike)).length
  const casualties = graded.filter((item) => item.strike).length

  return {
    week: week.week,
    status: week.status,
    statusLabel: weekStatusLabel(week.status),
    deadline: week.deadline,
    deadlineLabel: formatDeadline(week.deadline),
    picksIn: entries.length,
    survivors,
    casualties,
    popular,
    resultsIn: Object.keys(week.results).length,
    isCurrent: currentWeek ? currentWeek.week === week.week : false,
    picks: entries.map(([entrantId, pick]) => ({
      entrantId,
      name: standings.find((entrant) => entrant.id === entrantId)?.name || entrantId,
      pick,
      teamName: pick === BYE_PICK ? 'BYE week' : teamByAbbr.get(pick)?.name || pick,
      result: week.results[pick] || null
    }))
  }
}

function buildTeamUsage(teams, standings, currentWeek) {
  const used = new Map()
  const takenThisWeek = new Map()

  for (const entrant of standings) {
    for (const team of entrant.teamsUsed) {
      used.set(team.abbr, (used.get(team.abbr) || 0) + 1)
    }
    if (currentWeek && entrant.currentPick) {
      takenThisWeek.set(entrant.currentPick, (takenThisWeek.get(entrant.currentPick) || 0) + 1)
    }
  }

  return teams.map((team) => ({
    ...team,
    usedCount: used.get(team.abbr) || 0,
    pickedThisWeek: takenThisWeek.get(team.abbr) || 0
  }))
}

function buildRules(settings, teamCount) {
  const rules = [
    {
      title: 'One pick a week',
      body: `Pick a single ${settings.league} team to win each week. Locks at ${settings.pickDeadlineLabel}. Win and you advance.`
    },
    {
      title: 'Teams are one-time use',
      body: `Once you pick a team it is gone for the rest of the season. All ${teamCount} teams are available to start, and every pick you make — win or lose — burns that team.`
    },
    {
      title: settings.strikesToEliminate > 1 ? 'Two strikes and you are out' : 'One loss and you are out',
      body: settings.strikesToEliminate > 1
        ? `A loss is a strike, not an exit. You survive your first strike and are eliminated on strike ${settings.strikesToEliminate}.`
        : 'A single loss eliminates you immediately. Last player standing takes the pot.'
    },
    {
      title: 'Ties',
      body: settings.tieCountsAs === 'loss'
        ? 'A tie counts as a loss and costs you a strike. The team is still burned.'
        : 'A tie counts as a survive — no strike. The team is still burned.'
    },
    {
      title: 'Missed picks',
      body: settings.missedPickPolicy === 'strike'
        ? 'No pick in by the deadline is a strike. Get your pick in even if you are unsure.'
        : 'A missed pick is recorded but does not cost a strike.'
    },
    {
      title: 'BYE weeks',
      body: settings.byeWeeksPerPlayer > 0
        ? `Each player gets ${settings.byeWeeksPerPlayer} BYE week${settings.byeWeeksPerPlayer === 1 ? '' : 's'}. Taking a BYE skips the week without a strike and without burning a team.`
        : 'No BYE weeks. Every week needs a pick.'
    },
    {
      title: 'Buy-backs',
      body: settings.allowBuyBacks
        ? `Eliminated players may buy back in for ${formatMoney(settings.buyBackFee, settings.currency)} through Week ${settings.buyBackDeadlineWeek}. Bought-back entries return with a clean slate but are capped at the second-place bracket.`
        : 'No buy-backs. Once you are out, you are out.'
    },
    {
      title: 'Entry and payout',
      body: `${formatMoney(settings.entryFee, settings.currency)} to enter. ${settings.payoutNote}`
    }
  ]

  return rules
}

function pickCurrentWeek(weeks) {
  return weeks.find((week) => week.status === 'open')
    || weeks.find((week) => week.status !== 'final')
    || weeks.at(-1)
    || null
}

function countPicks(week, standings) {
  const aliveIds = new Set(standings.filter((entrant) => entrant.status !== 'eliminated').map((entrant) => entrant.id))
  return Object.entries(week.picks).filter(([id, pick]) => pick && aliveIds.has(id)).length
}

function sortStandings(list) {
  const rank = { winner: 0, alive: 1, eliminated: 2 }
  return [...list].sort((a, b) => {
    if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status]
    if (a.status === 'eliminated') return (b.eliminatedWeek || 0) - (a.eliminatedWeek || 0) || a.name.localeCompare(b.name)
    if (a.strikes !== b.strikes) return a.strikes - b.strikes
    if (a.teamsRemaining !== b.teamsRemaining) return b.teamsRemaining - a.teamsRemaining
    return a.name.localeCompare(b.name)
  })
}

function normalizeSettings(settings = {}) {
  const strikesToEliminate = clampInt(settings.strikesToEliminate, 1, 5, 2)
  return {
    title: settings.title || 'Survivor Pool',
    subtitle: settings.subtitle || 'One pick a week. Survive and advance.',
    season: Number(settings.season) || new Date().getFullYear(),
    league: settings.league || 'NFL',
    totalWeeks: clampInt(settings.totalWeeks, 1, 25, 18),
    strikesToEliminate,
    tieCountsAs: settings.tieCountsAs === 'loss' ? 'loss' : 'survive',
    allowBuyBacks: Boolean(settings.allowBuyBacks),
    buyBackFee: Number(settings.buyBackFee) || 0,
    buyBackDeadlineWeek: clampInt(settings.buyBackDeadlineWeek, 0, 25, 0),
    byeWeeksPerPlayer: clampInt(settings.byeWeeksPerPlayer, 0, 5, 0),
    missedPickPolicy: settings.missedPickPolicy === 'record' ? 'record' : 'strike',
    entryFee: Number(settings.entryFee) || 0,
    currency: settings.currency || 'USD',
    pickDeadlineLabel: settings.pickDeadlineLabel || 'Sunday 1:00 PM ET',
    payoutNote: settings.payoutNote || 'Last player standing takes the pot.',
    commissioner: settings.commissioner || null
  }
}

function normalizeTeams(teams = []) {
  return (Array.isArray(teams) ? teams : [])
    .filter((team) => team && team.abbr)
    .map((team) => ({
      abbr: String(team.abbr).toUpperCase(),
      name: team.name || String(team.abbr).toUpperCase(),
      conference: team.conference || '',
      division: team.division || ''
    }))
}

function normalizeEntrants(entrants = []) {
  return (Array.isArray(entrants) ? entrants : [])
    .filter((entrant) => entrant && entrant.id)
    .map((entrant) => ({
      id: String(entrant.id),
      name: entrant.name || String(entrant.id),
      role: entrant.role || null,
      paid: entrant.paid !== false
    }))
}

function normalizeWeeks(weeks = [], totalWeeks = 18) {
  const byWeek = new Map()

  for (const week of Array.isArray(weeks) ? weeks : []) {
    const number = Number(week?.week)
    if (!Number.isInteger(number) || number < 1) continue
    byWeek.set(number, {
      week: number,
      deadline: week.deadline || null,
      status: ['final', 'open', 'upcoming'].includes(week.status) ? week.status : 'upcoming',
      picks: normalizePicks(week.picks),
      results: normalizeResults(week.results)
    })
  }

  return Array.from({ length: totalWeeks }, (_, index) => byWeek.get(index + 1) || {
    week: index + 1,
    deadline: null,
    status: 'upcoming',
    picks: {},
    results: {}
  })
}

function normalizePicks(picks = {}) {
  return Object.fromEntries(
    Object.entries(picks || {})
      .filter(([, value]) => typeof value === 'string' && value.trim())
      .map(([key, value]) => [key, value.trim().toUpperCase()])
  )
}

function normalizeResults(results = {}) {
  return Object.fromEntries(
    Object.entries(results || {})
      .filter(([, value]) => ['win', 'loss', 'tie'].includes(String(value).toLowerCase()))
      .map(([key, value]) => [key.toUpperCase(), String(value).toLowerCase()])
  )
}

function weekStatusLabel(status) {
  if (status === 'final') return 'Final'
  if (status === 'open') return 'Picks open'
  return 'Upcoming'
}

function formatDeadline(value) {
  if (!value) return 'TBD'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'TBD'
  return date.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  })
}

function formatMoney(amount, currency = 'USD') {
  const value = Number(amount) || 0
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value)
  } catch {
    return `${value} ${currency}`
  }
}

function clampInt(value, min, max, fallback) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, Math.round(parsed)))
}

function warn(code, message) {
  return { code, message }
}
