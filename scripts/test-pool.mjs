import { buildPool } from './pool-engine.mjs'

const teams = ['DET','GB','KC','BUF','SF','DAL','PHI','MIA'].map((abbr) => ({ abbr, name: abbr + ' Team' }))
const base = {
  settings: { strikesToEliminate: 2, tieCountsAs: 'survive', totalWeeks: 5, entryFee: 20, byeWeeksPerPlayer: 0 },
  teams,
  entrants: [
    { id: 'a', name: 'Alice' }, { id: 'b', name: 'Bob' },
    { id: 'c', name: 'Cara' }, { id: 'd', name: 'Dan' }
  ],
  weeks: [
    { week: 1, status: 'final', picks: { a: 'DET', b: 'GB', c: 'KC', d: 'BUF' }, results: { DET: 'win', GB: 'loss', KC: 'tie', BUF: 'loss' } },
    { week: 2, status: 'final', picks: { a: 'SF', b: 'DAL', c: 'PHI', d: 'MIA' }, results: { SF: 'win', DAL: 'loss', PHI: 'win', MIA: 'loss' } },
    { week: 3, status: 'final', picks: { a: 'DET', b: 'KC', c: 'BUF' },            results: { DET: 'win', KC: 'win', BUF: 'win' } },
    { week: 4, status: 'open',  picks: { a: 'GB' }, results: {} },
    { week: 5, status: 'upcoming', picks: {}, results: {} }
  ]
}

const p = buildPool(base)
const by = Object.fromEntries(p.standings.map((s) => [s.name, s]))
let fails = 0
const check = (label, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (!ok) fails++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  got=${JSON.stringify(actual)} want=${JSON.stringify(expected)}`)
}

console.log('--- strikes / elimination ---')
check('Alice 0 strikes, alive', [by.Alice.strikes, by.Alice.status], [0, 'alive'])
check('Bob 2 strikes -> eliminated wk2', [by.Bob.strikes, by.Bob.status, by.Bob.eliminatedWeek], [2, 'eliminated', 2])
check('Cara tie=survive so 0 strikes', [by.Cara.strikes, by.Cara.status], [0, 'alive'])
check('Dan 2 losses -> eliminated wk2', [by.Dan.strikes, by.Dan.eliminatedWeek], [2, 2])

console.log('--- team burn / one-time use ---')
check('Alice burned DET,SF (wk3 DET is duplicate, not re-burned)', by.Alice.teamsUsed.map((t) => t.abbr), ['DET', 'SF'])
check('Alice wk3 flagged duplicate', by.Alice.history.find((h) => h.week === 3).outcome, 'duplicate')
check('duplicate raises a warning', p.warnings.some((w) => w.code === 'duplicate-team'), true)
check('Cara burned KC,PHI,BUF', by.Cara.teamsUsed.map((t) => t.abbr), ['KC', 'PHI', 'BUF'])
check('Cara teams remaining 8-3', by.Cara.teamsRemaining, 5)

console.log('--- eliminated players stop being graded ---')
check('Bob wk3 outcome is out', by.Bob.history.find((h) => h.week === 3).outcome, 'out')
check('Bob strikes capped at 2', by.Bob.strikes, 2)

console.log('--- current week / summary ---')
check('current week = 4 (open)', p.summary.currentWeek, 4)
check('alive count = 2', p.summary.aliveCount, 2)
check('picks in for wk4 = 1 (Alice)', p.summary.picksIn, 1)
check('pot = 4 x $20', p.summary.potLabel, '$80')
check('Alice current pick GB', by.Alice.currentPick, 'GB')
check('Cara no pick yet', by.Cara.currentPick, null)

console.log('--- week rollup ---')
const wk1 = p.weeks.find((w) => w.week === 1)
check('wk1 survivors = 2 (Alice win, Cara tie)', wk1.survivors, 2)
check('wk1 casualties = 2', wk1.casualties, 2)

console.log('--- single elimination variant ---')
const single = buildPool({ ...base, settings: { ...base.settings, strikesToEliminate: 1 } })
const s = Object.fromEntries(single.standings.map((x) => [x.name, x]))
check('Bob out in wk1 under single elim', [s.Bob.status, s.Bob.eliminatedWeek], ['eliminated', 1])
check('format label', single.summary.formatLabel, 'Single elimination')

console.log('--- tie counts as loss variant ---')
const tieLoss = buildPool({ ...base, settings: { ...base.settings, tieCountsAs: 'loss' } })
const t = Object.fromEntries(tieLoss.standings.map((x) => [x.name, x]))
check('Cara takes a strike on the tie', t.Cara.strikes, 1)

console.log('--- missed pick + BYE weeks ---')
const byes = buildPool({
  ...base,
  settings: { ...base.settings, byeWeeksPerPlayer: 1 },
  weeks: [
    { week: 1, status: 'final', picks: { a: 'BYE', b: {} }, results: { DET: 'win' } },
    { week: 2, status: 'final', picks: { a: 'BYE' }, results: { DET: 'win' } }
  ]
})
const yb = Object.fromEntries(byes.standings.map((x) => [x.name, x]))
check('Alice first BYE is free', yb.Alice.history[0].outcome, 'bye')
check('Alice second BYE is a strike', yb.Alice.history[1].outcome, 'strike')
check('Alice burned no teams on BYEs', yb.Alice.teamsUsedCount, 0)
check('Bob missed pick = strike', yb.Bob.history[0].outcome, 'missed')
check('missed pick warning raised', byes.warnings.some((w) => w.code === 'missed-pick'), true)

console.log('--- champion detection ---')
const champ = buildPool({
  ...base,
  weeks: [{ week: 1, status: 'final', picks: { a: 'DET', b: 'GB', c: 'KC', d: 'BUF' }, results: { DET: 'win', GB: 'loss', KC: 'loss', BUF: 'loss' } },
          { week: 2, status: 'final', picks: { b: 'DAL', c: 'PHI', d: 'MIA' }, results: { DAL: 'loss', PHI: 'loss', MIA: 'loss' } }]
})
check('one survivor -> winner', champ.summary.championName, 'Alice')
check('winner sorts first', champ.standings[0].status, 'winner')

console.log(fails ? `\n${fails} FAILING` : '\nAll assertions passed')
process.exit(fails ? 1 : 0)
