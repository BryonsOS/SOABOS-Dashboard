import './styles.css'

async function init() {
  const content = await fetch('./generated/content.json').then((res) => res.json())
  const app = document.querySelector('#app')

  const state = buildState(content)

  function render() {
    const route = parseRoute(window.location.hash)
    app.innerHTML = renderShell(state, route)
    wireRouteBehavior(app, state, route)
  }

  window.addEventListener('hashchange', render)
  render()
}

function buildState(content) {
  const { dashboard, current, projects, goals, areas, updates, birthdays, gratitude, events, fitness, warRoom, pool } = content
  const sortedProjects = [...projects].sort(sortProjects)
  const spotlightProject = sortedProjects[0] || null
  const topUpdate = updates.at(-1) || null
  const activeProjects = sortedProjects.filter((item) => String(item.data.status || '').toLowerCase() === 'active')
  const highPriorityProjects = sortedProjects.filter((item) => String(item.data.priority || '').toLowerCase() === 'high')
  const immediateMoves = buildImmediateMoves(current, sortedProjects)
  const laneGroups = buildLaneGroups(areas, sortedProjects)
  const hotProjects = sortedProjects.slice(0, 4)
  const recentUpdates = updates.slice().reverse().slice(0, 4)
  const birthdaysState = buildBirthdayState(birthdays)
  const allRecentBirthdays = birthdaysState.upcoming.slice(0, 12)
  const gratitudeCard = buildGratitudeCard(gratitude)
  const eventsCard = buildEventsCard(events)
  const fitnessCard = buildFitnessCard(fitness)
  const poolCard = buildPoolCard(pool)

  return {
    dashboard,
    current,
    projects,
    goals,
    areas,
    updates,
    birthdays,
    gratitude,
    events,
    fitness,
    warRoom,
    pool,
    sortedProjects,
    spotlightProject,
    topUpdate,
    activeProjects,
    highPriorityProjects,
    immediateMoves,
    laneGroups,
    hotProjects,
    recentUpdates,
    birthdaysState,
    allRecentBirthdays,
    gratitudeCard,
    eventsCard,
    fitnessCard,
    poolCard
  }
}

function renderShell(state, route) {
  const detail = renderRouteDetail(state, route)

  return `
    <div class="relative overflow-hidden">
      <div class="pointer-events-none absolute inset-0 opacity-60">
        <div class="absolute left-[-8rem] top-[-10rem] h-72 w-72 rounded-full bg-fire/12 blur-3xl"></div>
        <div class="absolute right-[-6rem] top-12 h-72 w-72 rounded-full bg-sky-400/10 blur-3xl"></div>
        <div class="absolute bottom-[-8rem] left-1/3 h-72 w-72 rounded-full bg-amber-300/8 blur-3xl"></div>
      </div>

      <main class="relative mx-auto flex min-h-screen w-full max-w-[1280px] flex-col gap-4 px-4 pb-16 pt-4 sm:px-6 lg:px-8 lg:pb-24 lg:pt-6">
        ${renderTopBar(state, route)}
        ${route.name === 'home' ? renderHome(state) : detail}
      </main>
    </div>
  `
}

function renderTopBar(state, route) {
  return `
    <section class="glass-card overflow-hidden p-4 sm:p-5 lg:p-6">
      <div class="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div class="min-w-0">
          <div class="mb-3 flex flex-wrap items-center gap-2">
            <span class="chip chip-warm">${state.dashboard.site.title}</span>
            <span class="chip">Owner · ${state.dashboard.site.owner}</span>
            <span class="chip">Mode · ${state.current.data.currentState}</span>
          </div>
          <p class="section-kicker">Command deck</p>
          <div class="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 class="max-w-[14ch] text-3xl font-semibold tracking-[-0.05em] text-copy sm:text-4xl lg:text-5xl">${state.dashboard.site.tagline}</h1>
              <p class="mt-3 max-w-3xl text-sm leading-6 text-copy-soft sm:text-base">${state.dashboard.site.description}</p>
            </div>
            <div class="rounded-[24px] border border-line bg-panel-strong px-4 py-4 lg:min-w-[320px]">
              <p class="micro-label text-fire">Current focus</p>
              <h2 class="mt-2 text-lg font-semibold text-copy">${state.current.data.title}</h2>
              <p class="mt-2 text-sm leading-6 text-copy-soft">${(state.current.data.next && state.current.data.next[0]) || 'Choose the clearest next move and keep it visible.'}</p>
            </div>
          </div>
        </div>

        <nav class="grid gap-2 sm:grid-cols-2 xl:w-[360px]">
          ${renderNavLink('#/', 'Overview', route.name === 'home')}
          ${renderNavLink('#/prompt', 'Daily prompt', route.name === 'prompt')}
          ${renderNavLink('#/birthdays', 'Birthdays', route.name === 'birthdays')}
          ${renderNavLink('#/pool', 'Survivor pool', route.name === 'pool')}
          ${renderNavLink('#/projects', 'Projects', route.name === 'projects' || route.name === 'project')}
          ${renderNavLink('#/updates', 'Updates', route.name === 'updates')}
        </nav>
      </div>
    </section>
  `
}

function renderNavLink(href, label, active = false) {
  return `<a class="nav-chip ${active ? 'nav-chip-active' : ''}" href="${href}">${label}</a>`
}

function renderHome(state) {
  return `
    ${renderGratitudeWidget(state.gratitudeCard)}

    <section class="grid gap-4 xl:grid-cols-[1fr_1fr]">
      ${renderEventsWidget(state.eventsCard)}
      ${renderFitnessWidget(state.fitnessCard)}
    </section>

    ${renderPoolWidget(state.poolCard)}

    <section class="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
      <div class="stack-card compact-card">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p class="section-kicker">Immediate moves</p>
            <h2 class="text-2xl font-semibold tracking-[-0.03em] text-copy">What matters now</h2>
            <p class="mt-2 max-w-2xl text-sm leading-6 text-copy-soft">One-page read. Click into any lane when you want the full picture.</p>
          </div>
          <div class="flex flex-wrap gap-2">
            <span class="chip chip-warm">${state.immediateMoves.length} moves</span>
            <span class="chip">Updated ${formatRelativeOrAbsoluteDate(state.current.data.lastUpdated)}</span>
          </div>
        </div>
        <div class="mt-4 grid gap-3 md:grid-cols-3">
          ${state.immediateMoves.map(renderImmediateMoveCard).join('')}
        </div>
      </div>

      <aside class="stack-card compact-card">
        <p class="section-kicker">Board status</p>
        <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          ${renderStatCard('Active projects', state.activeProjects.length, 'Projects in motion right now.')}
          ${renderStatCard('High priority', state.highPriorityProjects.length, 'Needs stronger attention.')}
          ${renderStatCard('Birthday radar', state.birthdays.summary?.upcomingCount ?? 0, 'Upcoming birthdays loaded.')}
          ${renderStatCard('System status', state.dashboard.stats.status, 'Board is live and steerable.')}
        </div>
      </aside>
    </section>

    <section class="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
      ${renderCompactBirthdayCard(state)}
      ${renderCompactProjectsCard(state)}
    </section>

    <section class="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
      ${renderCompactSpotlightCard(state)}
      ${renderCompactUpdatesCard(state)}
    </section>

    <section class="grid gap-4 xl:grid-cols-[1fr_1fr]">
      <section class="stack-card compact-card">
        <div class="mb-4 flex items-end justify-between gap-4">
          <div>
            <p class="section-kicker">Operating lanes</p>
            <h2 class="text-2xl font-semibold tracking-[-0.03em] text-copy">Where the work lives</h2>
          </div>
          <span class="chip">${state.laneGroups.length} lanes</span>
        </div>
        <div class="grid gap-3">
          ${state.laneGroups.map(renderLaneGroupCompact).join('')}
        </div>
      </section>

      <section class="stack-card compact-card">
        <div class="mb-4 flex items-end justify-between gap-4">
          <div>
            <p class="section-kicker">Focus stack</p>
            <h2 class="text-2xl font-semibold tracking-[-0.03em] text-copy">Now / next / blockers / wins</h2>
          </div>
        </div>
        <div class="grid gap-3 sm:grid-cols-2">
          ${renderFocusCard('Now', state.current.data.primaryFocus, 'orange')}
          ${renderFocusCard('Next', state.current.data.next || [], 'default')}
          ${renderFocusCard('Blockers', state.current.data.blockers || [], 'warning')}
          ${renderFocusCard('Wins', state.current.data.wins || [], 'success')}
        </div>
      </section>
    </section>
  `
}

function renderCompactBirthdayCard(state) {
  const nextBirthdays = state.allRecentBirthdays.slice(0, 4)
  const nextUp = nextBirthdays[0]
  const aprilCount = (state.birthdaysState.byMonth.april || []).length

  return `
    <section class="stack-card compact-card">
      <div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p class="section-kicker">People lane</p>
          <h2 class="text-2xl font-semibold tracking-[-0.03em] text-copy">Birthday radar</h2>
          <p class="mt-2 text-sm leading-6 text-copy-soft">Homepage stays short. Click through for the month view and profiles.</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <a class="chip chip-warm" href="#/birthdays">Open birthdays</a>
          <a class="chip" href="#/birthdays/april">View April</a>
        </div>
      </div>

      <div class="grid gap-3 lg:grid-cols-[0.8fr_1.2fr]">
        <article class="birthday-widget-hero compact-hero">
          <p class="micro-label text-fire">Next up</p>
          <h3 class="mt-2 text-2xl font-semibold tracking-[-0.03em] text-copy">${nextUp ? nextUp.name : 'All clear'}</h3>
          <p class="mt-2 text-sm leading-6 text-copy-soft">${nextUp ? `${nextUp.dateLabel} · ${formatDaysAway(nextUp.daysAway)} · ${nextUp.relationship || 'Contact'}` : 'No birthdays loaded in the current lookahead.'}</p>
          <div class="mt-4 flex flex-wrap gap-2">
            <span class="chip chip-warm">${state.birthdays.summary?.upcomingCount ?? 0} upcoming</span>
            <span class="chip">April · ${aprilCount}</span>
          </div>
        </article>

        <div class="grid gap-3 sm:grid-cols-2">
          ${nextBirthdays.map((item) => renderBirthdayWeekItem(item, true)).join('')}
        </div>
      </div>
    </section>
  `
}

function renderCompactProjectsCard(state) {
  return `
    <section class="stack-card compact-card">
      <div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p class="section-kicker">Projects</p>
          <h2 class="text-2xl font-semibold tracking-[-0.03em] text-copy">Current status board</h2>
          <p class="mt-2 text-sm leading-6 text-copy-soft">Just the active picture here. Click any project to open deeper detail.</p>
        </div>
        <a class="chip chip-warm" href="#/projects">Open all projects</a>
      </div>
      <div class="grid gap-3">
        ${state.hotProjects.map((item, index) => renderProjectSummaryRow(item, index + 1)).join('')}
      </div>
    </section>
  `
}

function renderCompactSpotlightCard(state) {
  const item = state.spotlightProject

  return `
    <section class="stack-card compact-card">
      <div class="mb-4 flex items-end justify-between gap-4">
        <div>
          <p class="section-kicker">Spotlight</p>
          <h2 class="text-2xl font-semibold tracking-[-0.03em] text-copy">Lead project</h2>
        </div>
        ${item ? `<a class="chip chip-warm" href="#/projects/${item.data.slug}">Open detail</a>` : ''}
      </div>
      ${item ? `
        <article class="rounded-[24px] border border-line bg-white/[0.04] p-5">
          <div class="flex flex-wrap items-center gap-2">
            <span class="chip chip-warm">${item.data.status}</span>
            <span class="chip">${capitalize(item.data.priority)} priority</span>
            <span class="chip">${humanizeToken(item.data.area)}</span>
          </div>
          <h3 class="mt-4 text-2xl font-semibold tracking-[-0.03em] text-copy">${item.data.title}</h3>
          <p class="mt-3 text-sm leading-6 text-copy-soft">${item.data.summary}</p>
          <div class="mt-4 rounded-[20px] border border-fire/18 bg-fire-soft px-4 py-4">
            <p class="micro-label text-fire">Next move</p>
            <p class="mt-2 text-sm leading-6 text-copy">${item.data.nextAction}</p>
          </div>
        </article>
      ` : '<p class="text-sm text-copy-soft">No spotlight project loaded yet.</p>'}
    </section>
  `
}

function renderCompactUpdatesCard(state) {
  return `
    <section class="stack-card compact-card">
      <div class="mb-4 flex items-end justify-between gap-4">
        <div>
          <p class="section-kicker">Recent motion</p>
          <h2 class="text-2xl font-semibold tracking-[-0.03em] text-copy">Updates feed</h2>
        </div>
        <a class="chip chip-warm" href="#/updates">Open feed</a>
      </div>
      <div class="grid gap-3">
        ${state.recentUpdates.map(renderUpdateCompactCard).join('')}
      </div>
    </section>
  `
}

function renderRouteDetail(state, route) {
  if (route.name === 'prompt') {
    return renderPromptRoute(state)
  }

  if (route.name === 'birthdays') {
    return renderBirthdaysRoute(state, route)
  }

  if (route.name === 'pool') {
    return renderPoolRoute(state)
  }

  if (route.name === 'projects') {
    return renderProjectsRoute(state)
  }

  if (route.name === 'project') {
    return renderProjectDetailRoute(state, route.slug)
  }

  if (route.name === 'updates') {
    return renderUpdatesRoute(state)
  }

  return renderHome(state)
}

function renderPromptRoute(state) {
  return `
    <section class="stack-card compact-card">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p class="section-kicker">Daily rhythm</p>
          <h2 class="text-3xl font-semibold tracking-[-0.03em] text-copy">Daily prompt</h2>
          <p class="mt-2 max-w-2xl text-sm leading-6 text-copy-soft">A clean direct view for today’s gratitude prompt without needing to scroll the whole dashboard.</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <a class="chip" href="#/">Back to overview</a>
        </div>
      </div>
    </section>

    ${renderGratitudeWidget(state.gratitudeCard)}
  `
}

function renderBirthdaysRoute(state, route) {
  const monthLabel = route.month ? capitalize(route.month) : null
  const monthItems = route.month ? (state.birthdaysState.byMonth[route.month] || []) : []
  const allMonths = state.birthdaysState.monthOrder.filter((month) => (state.birthdaysState.byMonth[month] || []).length)

  return `
    <section class="stack-card compact-card">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p class="section-kicker">Birthdays</p>
          <h2 class="text-3xl font-semibold tracking-[-0.03em] text-copy">${monthLabel ? `${monthLabel} birthdays` : 'Birthday command view'}</h2>
          <p class="mt-2 max-w-2xl text-sm leading-6 text-copy-soft">${monthLabel ? `Month detail for ${monthLabel}.` : 'This is the deeper drill-down: month tabs, upcoming list, and profile hints.'}</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <a class="chip" href="#/">Back to overview</a>
          ${allMonths.map((month) => `<a class="chip ${route.month === month ? 'chip-warm' : ''}" href="#/birthdays/${month}">${capitalize(month)}</a>`).join('')}
        </div>
      </div>
    </section>

    ${!route.month ? `
      <section class="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <section class="stack-card compact-card">
          <div class="mb-4 flex items-end justify-between gap-4">
            <div>
              <p class="section-kicker">Upcoming</p>
              <h3 class="text-2xl font-semibold tracking-[-0.03em] text-copy">Next birthdays</h3>
            </div>
            <span class="chip chip-warm">${state.allRecentBirthdays.length} loaded</span>
          </div>
          <div class="grid gap-3">
            ${state.allRecentBirthdays.map((item) => renderBirthdayWeekItem(item)).join('')}
          </div>
        </section>

        <section class="stack-card compact-card">
          <div class="mb-4 flex items-end justify-between gap-4">
            <div>
              <p class="section-kicker">Months</p>
              <h3 class="text-2xl font-semibold tracking-[-0.03em] text-copy">Browse by month</h3>
            </div>
          </div>
          <div class="grid gap-3 sm:grid-cols-2">
            ${allMonths.map((month) => renderMonthCard(month, state.birthdaysState.byMonth[month])).join('')}
          </div>
        </section>
      </section>
    ` : `
      <section class="stack-card compact-card">
        <div class="mb-4 flex items-end justify-between gap-4">
          <div>
            <p class="section-kicker">Month detail</p>
            <h3 class="text-2xl font-semibold tracking-[-0.03em] text-copy">${monthLabel} list</h3>
          </div>
          <span class="chip chip-warm">${monthItems.length} people</span>
        </div>
        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          ${monthItems.map((item) => renderBirthdayProfileCard(item)).join('')}
        </div>
      </section>
    `}
  `
}

function renderProjectsRoute(state) {
  return `
    <section class="stack-card compact-card">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p class="section-kicker">Projects</p>
          <h2 class="text-3xl font-semibold tracking-[-0.03em] text-copy">Project drill-downs</h2>
          <p class="mt-2 max-w-2xl text-sm leading-6 text-copy-soft">The homepage shows status and next moves. This page opens the deeper context.</p>
        </div>
        <a class="chip" href="#/">Back to overview</a>
      </div>
    </section>

    <section class="grid gap-4 md:grid-cols-2">
      ${state.sortedProjects.map((item) => renderProjectDrillCard(item)).join('')}
    </section>
  `
}

function renderProjectDetailRoute(state, slug) {
  const item = state.sortedProjects.find((project) => project.data.slug === slug)

  if (!item) {
    return `
      <section class="stack-card compact-card">
        <p class="section-kicker">Project</p>
        <h2 class="text-3xl font-semibold tracking-[-0.03em] text-copy">Project not found</h2>
        <p class="mt-3 text-sm leading-6 text-copy-soft">That project route does not exist yet.</p>
        <div class="mt-4">
          <a class="chip chip-warm" href="#/projects">Back to projects</a>
        </div>
      </section>
    `
  }

  const relatedUpdates = state.updates
    .slice()
    .reverse()
    .filter((update) => {
      const hay = `${update.data.title || ''} ${update.content || ''}`.toLowerCase()
      return hay.includes((item.data.title || '').toLowerCase()) || hay.includes((slug || '').replace(/-/g, ' '))
    })
    .slice(0, 4)

  const warRoomPanel = slug === 'sick-sales-war-room' ? renderWarRoomPanel(state.warRoom) : ''

  return `
    <section class="stack-card compact-card">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p class="section-kicker">Project detail</p>
          <h2 class="text-3xl font-semibold tracking-[-0.03em] text-copy">${item.data.title}</h2>
          <p class="mt-2 max-w-2xl text-sm leading-6 text-copy-soft">${item.data.summary}</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <a class="chip" href="#/projects">Back to projects</a>
          ${Object.entries(item.data.links || {}).map(([label, href]) => renderLink(label, href)).join('')}
        </div>
      </div>
    </section>

    <section class="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
      <section class="stack-card compact-card">
        <div class="grid gap-3 sm:grid-cols-2">
          <div class="detail-stat">
            <p class="micro-label text-copy-faint">Status</p>
            <p class="mt-2 text-lg font-semibold text-copy">${item.data.status}</p>
          </div>
          <div class="detail-stat">
            <p class="micro-label text-copy-faint">Priority</p>
            <p class="mt-2 text-lg font-semibold text-copy">${capitalize(item.data.priority)}</p>
          </div>
          <div class="detail-stat">
            <p class="micro-label text-copy-faint">Area</p>
            <p class="mt-2 text-lg font-semibold text-copy">${humanizeToken(item.data.area)}</p>
          </div>
          <div class="detail-stat">
            <p class="micro-label text-copy-faint">Updated</p>
            <p class="mt-2 text-lg font-semibold text-copy">${formatRelativeOrAbsoluteDate(item.data.lastUpdated)}</p>
          </div>
        </div>

        <div class="mt-4 rounded-[24px] border border-fire/18 bg-fire-soft p-5">
          <p class="micro-label text-fire">Next build thought</p>
          <p class="mt-2 text-sm leading-6 text-copy">${item.data.nextAction}</p>
        </div>
      </section>

      <section class="stack-card compact-card">
        <p class="section-kicker">Why it exists</p>
        <div class="project-copy">${renderMarkdownish(item.content)}</div>
      </section>
    </section>

    ${warRoomPanel}

    <section class="grid gap-4 xl:grid-cols-[1fr_1fr]">
      <section class="stack-card compact-card">
        <div class="mb-4 flex items-end justify-between gap-4">
          <div>
            <p class="section-kicker">Recent motion</p>
            <h3 class="text-2xl font-semibold tracking-[-0.03em] text-copy">Related updates</h3>
          </div>
          <span class="chip chip-warm">${relatedUpdates.length} linked</span>
        </div>
        <div class="grid gap-3">
          ${relatedUpdates.length ? relatedUpdates.map(renderUpdateCompactCard).join('') : '<article class="rounded-[22px] border border-line bg-white/[0.04] p-4"><p class="text-sm leading-6 text-copy-soft">No linked updates yet. This page is ready for them.</p></article>'}
        </div>
      </section>

      <section class="stack-card compact-card">
        <div class="mb-4 flex items-end justify-between gap-4">
          <div>
            <p class="section-kicker">Board context</p>
            <h3 class="text-2xl font-semibold tracking-[-0.03em] text-copy">Operating fit</h3>
          </div>
        </div>
        <div class="grid gap-3">
          <article class="rounded-[22px] border border-line bg-white/[0.04] p-4">
            <p class="micro-label text-fire">Current role</p>
            <p class="mt-2 text-sm leading-6 text-copy-soft">This project lives in the ${humanizeToken(item.data.area)} lane and is being tracked as ${item.data.status}.</p>
          </article>
          <article class="rounded-[22px] border border-line bg-white/[0.04] p-4">
            <p class="micro-label text-fire">Why it matters</p>
            <p class="mt-2 text-sm leading-6 text-copy-soft">The command deck should let Bryon scan the current state fast, then click in here for the deeper project picture without crowding the homepage.</p>
          </article>
        </div>
      </section>
    </section>
  `
}

function renderWarRoomPanel(warRoom = {}) {
  const recommendation = warRoom.recommendation || null
  const todayBoard = warRoom.todayBoard || {}
  const executionAssets = warRoom.executionAssets || {}
  const buckets = warRoom.summary?.buckets || {}
  const topPush = Array.isArray(warRoom.topPush) ? warRoom.topPush.slice(0, 5) : []
  const topBundle = Array.isArray(warRoom.topBundle) ? warRoom.topBundle.slice(0, 5) : []
  const protect = Array.isArray(warRoom.protect) ? warRoom.protect.slice(0, 5) : []
  const outWinners = Array.isArray(warRoom.outWinners) ? warRoom.outWinners.slice(0, 5) : []

  return `
    <section class="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
      <section class="stack-card compact-card">
        <div class="mb-4 flex items-end justify-between gap-4">
          <div>
            <p class="section-kicker">War room data</p>
            <h3 class="text-2xl font-semibold tracking-[-0.03em] text-copy">Current recommendation</h3>
          </div>
          <span class="chip chip-warm">${warRoom.summary?.actionableRows ?? 0} actionable rows</span>
        </div>

        ${recommendation ? `
          <article class="rounded-[24px] border border-fire/18 bg-fire-soft p-5">
            <p class="micro-label text-fire">Push today</p>
            <h4 class="mt-3 text-xl font-semibold text-copy">${recommendation.hero || 'No hero picked'}</h4>
            <p class="mt-2 text-sm leading-6 text-copy-soft">${[recommendation.heroVariant, recommendation.channel].filter(Boolean).join(' · ')}</p>
            ${recommendation.addOn ? `<p class="mt-3 text-sm leading-6 text-copy"><span class="text-copy-faint">Add-on:</span> ${recommendation.addOn}</p>` : ''}
            ${recommendation.offer ? `<p class="mt-2 text-sm leading-6 text-copy"><span class="text-copy-faint">Offer:</span> ${recommendation.offer}</p>` : ''}
            ${recommendation.inventoryReality ? `<p class="mt-2 text-sm leading-6 text-copy"><span class="text-copy-faint">Inventory read:</span> ${recommendation.inventoryReality}</p>` : ''}
            <div class="mt-4 flex flex-wrap gap-2">
              ${(recommendation.why || []).map((item) => `<span class="chip">${item}</span>`).join('')}
            </div>
          </article>
        ` : '<article class="rounded-[24px] border border-line bg-white/[0.04] p-5"><p class="text-sm leading-6 text-copy-soft">No recommendation generated yet.</p></article>'}

        <div class="mt-4 grid gap-3 sm:grid-cols-2">
          ${renderStatCard('Push What Is Left', buckets['Push What Is Left'] ?? 0, 'Best remaining in-stock products to feature now.')}
          ${renderStatCard('Bundle / Test', buckets['Bundle / Test'] ?? 0, 'Use as add-ons, offer fillers, and test candidates.')}
          ${renderStatCard('Protect / Low Stock', buckets['Protect / Low Stock'] ?? 0, 'Good sellers with thin inventory — use carefully.')}
          ${renderStatCard('Out of Stock Winners', buckets['Out of Stock Winners'] ?? 0, 'Strong demand signals that need restock or replacement.')}
        </div>
      </section>

      <section class="stack-card compact-card">
        <div class="mb-4 flex items-end justify-between gap-4">
          <div>
            <p class="section-kicker">Today board</p>
            <h3 class="text-2xl font-semibold tracking-[-0.03em] text-copy">Now / next / watch / problems / moves</h3>
          </div>
        </div>
        <div class="grid gap-3 sm:grid-cols-2">
          ${renderFocusCard('Now', todayBoard.now || [], 'orange')}
          ${renderFocusCard('Next', todayBoard.next || [], 'default')}
          ${renderFocusCard('Watch', todayBoard.watch || [], 'warning')}
          ${renderFocusCard('Problems', todayBoard.problems || [], 'warning')}
          <div class="sm:col-span-2">${renderFocusCard('Moves', todayBoard.moves || [], 'success')}</div>
        </div>
      </section>
    </section>

    <section class="stack-card compact-card">
      <div class="mb-4 flex items-end justify-between gap-4">
        <div>
          <p class="section-kicker">Execution assets</p>
          <h3 class="text-2xl font-semibold tracking-[-0.03em] text-copy">Ready-to-use moves</h3>
        </div>
      </div>
      <div class="grid gap-3 xl:grid-cols-2">
        <article class="rounded-[22px] border border-line bg-white/[0.04] p-4">
          <p class="micro-label text-fire">Homepage slot</p>
          <h4 class="mt-3 text-lg font-semibold text-copy">${executionAssets.homepage?.headline || 'No homepage slot loaded.'}</h4>
          ${executionAssets.homepage?.subhead ? `<p class="mt-2 text-sm leading-6 text-copy-soft">${executionAssets.homepage.subhead}</p>` : ''}
          <div class="mt-3 flex flex-wrap gap-2">
            ${executionAssets.homepage?.kicker ? `<span class="chip chip-warm">${executionAssets.homepage.kicker}</span>` : ''}
            ${executionAssets.homepage?.cta ? `<span class="chip">CTA: ${executionAssets.homepage.cta}</span>` : ''}
          </div>
        </article>
        <article class="rounded-[22px] border border-line bg-white/[0.04] p-4">
          <p class="micro-label text-fire">Email angle</p>
          ${executionAssets.email?.subject ? `<p class="mt-3 text-sm leading-6 text-copy"><span class="text-copy-faint">Subject:</span> ${executionAssets.email.subject}</p>` : ''}
          ${executionAssets.email?.preview ? `<p class="mt-2 text-sm leading-6 text-copy"><span class="text-copy-faint">Preview:</span> ${executionAssets.email.preview}</p>` : ''}
          ${executionAssets.email?.body ? `<p class="mt-3 text-sm leading-6 text-copy-soft">${executionAssets.email.body}</p>` : ''}
        </article>
        <article class="rounded-[22px] border border-line bg-white/[0.04] p-4 xl:col-span-2">
          <p class="micro-label text-fire">IG story frames</p>
          <ul class="mt-3 list-dot space-y-2 pl-5 text-sm leading-6 text-copy-soft">${(executionAssets.igStory || []).map((item) => `<li>${item}</li>`).join('')}</ul>
        </article>
        <article class="rounded-[22px] border border-line bg-white/[0.04] p-4 xl:col-span-2">
          <p class="micro-label text-fire">KPI target</p>
          <h4 class="mt-3 text-lg font-semibold text-copy">${executionAssets.kpi?.title || 'Tonight\'s read'}</h4>
          ${executionAssets.kpi?.target ? `<p class="mt-2 text-sm leading-6 text-copy-soft">${executionAssets.kpi.target}</p>` : ''}
          ${executionAssets.kpi?.rule ? `<p class="mt-2 text-sm leading-6 text-copy"><span class="text-copy-faint">Rule:</span> ${executionAssets.kpi.rule}</p>` : ''}
        </article>
      </div>
    </section>

    <section class="stack-card compact-card">
      <div class="mb-4 flex items-end justify-between gap-4">
        <div>
          <p class="section-kicker">Top products</p>
          <h3 class="text-2xl font-semibold tracking-[-0.03em] text-copy">What the data says</h3>
        </div>
      </div>
      <div class="grid gap-3 xl:grid-cols-2">
        <article class="rounded-[22px] border border-line bg-white/[0.04] p-4">
          <p class="micro-label text-fire">Push what is left</p>
          <div class="mt-3 grid gap-3">${topPush.length ? topPush.map((item) => renderWarRoomItem(item)).join('') : '<p class="text-sm leading-6 text-copy-soft">No immediate in-stock push items found.</p>'}</div>
        </article>
        <article class="rounded-[22px] border border-line bg-white/[0.04] p-4">
          <p class="micro-label text-fire">Bundle / test</p>
          <div class="mt-3 grid gap-3">${topBundle.length ? topBundle.map((item) => renderWarRoomItem(item)).join('') : '<p class="text-sm leading-6 text-copy-soft">No bundle candidates found.</p>'}</div>
        </article>
        <article class="rounded-[22px] border border-line bg-white/[0.04] p-4">
          <p class="micro-label text-fire">Protect / low stock</p>
          <div class="mt-3 grid gap-3">${protect.length ? protect.map((item) => renderWarRoomItem(item)).join('') : '<p class="text-sm leading-6 text-copy-soft">No low-stock protect items found.</p>'}</div>
        </article>
        <article class="rounded-[22px] border border-line bg-white/[0.04] p-4">
          <p class="micro-label text-fire">Out of stock winners</p>
          <div class="mt-3 grid gap-3">${outWinners.length ? outWinners.map((item) => renderWarRoomItem(item)).join('') : '<p class="text-sm leading-6 text-copy-soft">No out-of-stock demand signals found.</p>'}</div>
        </article>
      </div>
    </section>
  `
}

function renderWarRoomItem(item) {
  return `
    <article class="phase-lane-item phase-lane-item-compact">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 class="text-base font-semibold text-copy">${item.title}</h4>
          <p class="mt-1 text-sm leading-6 text-copy-soft">${[item.variant !== 'Default Title' ? item.variant : '', item.type, item.vendor].filter(Boolean).join(' · ')}</p>
        </div>
        <span class="chip chip-warm">${item.bucket}</span>
      </div>
      <div class="mt-3 flex flex-wrap gap-2">
        ${item.price != null ? `<span class="chip">$${item.price}</span>` : ''}
        ${item.sales90 != null ? `<span class="chip">90d sales: ${item.sales90}</span>` : ''}
        ${item.availableInventory != null ? `<span class="chip">inv: ${item.availableInventory}</span>` : ''}
        ${item.revenue90 != null ? `<span class="chip">rev: $${Math.round(item.revenue90)}</span>` : ''}
      </div>
      ${item.note ? `<p class="mt-2 text-sm leading-6 text-copy-faint">${item.note}</p>` : ''}
    </article>
  `
}

function renderUpdatesRoute(state) {
  const allUpdates = state.updates.slice().reverse()

  return `
    <section class="stack-card compact-card">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p class="section-kicker">Updates</p>
          <h2 class="text-3xl font-semibold tracking-[-0.03em] text-copy">Recent motion feed</h2>
          <p class="mt-2 max-w-2xl text-sm leading-6 text-copy-soft">The homepage shows the latest few. This page keeps the full recent feed in one place.</p>
        </div>
        <a class="chip" href="#/">Back to overview</a>
      </div>
    </section>

    <section class="grid gap-3">
      ${allUpdates.map(renderUpdateFullCard).join('')}
    </section>
  `
}

function renderImmediateMoveCard(item) {
  return `
    <article class="rounded-[24px] border border-fire/18 bg-fire-soft p-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <p class="micro-label text-fire">${item.lane}</p>
        <span class="chip">${item.tag}</span>
      </div>
      <h3 class="mt-3 text-lg font-semibold tracking-[-0.03em] text-copy">${item.title}</h3>
      <p class="mt-2 text-sm leading-6 text-copy-soft">${item.action}</p>
    </article>
  `
}

function renderStatCard(label, value, helper) {
  return `
    <article class="stat-card compact-stat-card">
      <div>
        <p class="micro-label text-copy-faint">${label}</p>
        <p class="mt-2 text-sm leading-6 text-copy-soft">${helper}</p>
      </div>
      <strong class="text-right text-2xl font-semibold tracking-[-0.04em] text-copy sm:text-3xl">${value}</strong>
    </article>
  `
}

function renderProjectSummaryRow(item, rank) {
  return `
    <a class="project-row" href="#/projects/${item.data.slug}">
      <div class="project-row-rank">${rank}</div>
      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-2">
          <span class="chip chip-warm">${item.data.status}</span>
          <span class="chip">${capitalize(item.data.priority)} priority</span>
          <span class="chip">${humanizeToken(item.data.area)}</span>
        </div>
        <h3 class="mt-3 text-lg font-semibold text-copy">${item.data.title}</h3>
        <p class="mt-2 text-sm leading-6 text-copy-soft">${item.data.summary}</p>
        <p class="mt-3 text-sm leading-6 text-copy"><span class="text-copy-faint">Next:</span> ${item.data.nextAction}</p>
      </div>
      <div class="project-row-arrow">↗</div>
    </a>
  `
}

function renderUpdateCompactCard(item) {
  return `
    <article class="rounded-[22px] border border-line bg-white/[0.04] p-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <p class="micro-label text-fire">${formatRelativeOrAbsoluteDate(item.data.date)}</p>
        <span class="chip">${item.data.kind}</span>
      </div>
      <h3 class="mt-3 text-lg font-semibold text-copy">${item.data.title}</h3>
      <p class="mt-2 text-sm leading-6 text-copy-soft">${item.content}</p>
    </article>
  `
}

function renderUpdateFullCard(item) {
  return `
    <article class="rounded-[24px] border border-line bg-white/[0.04] p-5">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p class="micro-label text-fire">${formatRelativeOrAbsoluteDate(item.data.date)}</p>
          <h3 class="mt-3 text-xl font-semibold text-copy">${item.data.title}</h3>
        </div>
        <span class="chip chip-warm">${item.data.kind}</span>
      </div>
      <p class="mt-3 text-sm leading-7 text-copy-soft">${item.content}</p>
    </article>
  `
}

function renderFocusCard(title, items = [], tone = 'default') {
  const safeItems = items.length ? items : ['Nothing loaded yet.']
  const toneMap = {
    orange: 'border-fire/25 bg-fire-soft',
    warning: 'border-amber-400/20 bg-amber-400/10',
    success: 'border-emerald-400/20 bg-emerald-400/10',
    default: 'border-line bg-white/5'
  }

  return `
    <article class="glass-card p-4 ${toneMap[tone] || toneMap.default}">
      <p class="section-kicker">${title}</p>
      <ul class="list-dot space-y-2 pl-5 text-sm leading-6 text-copy-soft">
        ${safeItems.map((item) => `<li>${item}</li>`).join('')}
      </ul>
    </article>
  `
}

function renderLaneGroupCompact(group) {
  return `
    <article class="lane-card compact-lane-card">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p class="micro-label text-fire">${group.label}</p>
          <h3 class="mt-2 text-lg font-semibold text-copy">${group.title}</h3>
          <p class="mt-2 text-sm leading-6 text-copy-soft">${group.summary}</p>
        </div>
        <span class="chip chip-warm">${group.projects.length}</span>
      </div>
      <div class="mt-3 flex flex-wrap gap-2">
        ${group.projects.length ? group.projects.map((item) => `<a class="chip" href="#/projects/${item.data.slug}">${item.data.title}</a>`).join('') : '<span class="chip">No active projects</span>'}
      </div>
    </article>
  `
}

function renderBirthdayWeekItem(item, compact = false) {
  return `
    <a class="birthday-week-item ${compact ? 'birthday-week-item-compact' : ''}" href="#/birthdays/${monthSlugFromDateLabel(item.dateLabel)}">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p class="micro-label text-fire">${formatDaysAway(item.daysAway)}</p>
          <h3 class="mt-2 text-lg font-semibold text-copy">${item.name}</h3>
          <p class="mt-2 text-sm leading-6 text-copy-soft">${[item.relationship, item.category].filter(Boolean).join(' · ')}</p>
        </div>
        <span class="chip chip-warm">${item.dateLabel}</span>
      </div>
      ${(item.interests || item.profile || item.leadTime) ? `<p class="mt-3 text-sm leading-6 text-copy-faint">${[item.leadTime ? `Prep: ${item.leadTime}` : '', item.interests ? `Likes: ${item.interests}` : '', item.profile].filter(Boolean).join(' · ')}</p>` : ''}
    </a>
  `
}

function renderMonthCard(month, items = []) {
  const nextName = items[0]?.name || 'No one loaded'
  return `
    <a class="month-card" href="#/birthdays/${month}">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p class="micro-label text-fire">Month</p>
          <h3 class="mt-2 text-xl font-semibold text-copy">${capitalize(month)}</h3>
        </div>
        <span class="chip chip-warm">${items.length}</span>
      </div>
      <p class="mt-3 text-sm leading-6 text-copy-soft">Next listed: ${nextName}</p>
    </a>
  `
}

function renderBirthdayProfileCard(item) {
  return `
    <article class="rounded-[24px] border border-line bg-white/[0.04] p-5">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <p class="micro-label text-fire">${item.dateLabel}</p>
        <span class="chip chip-warm">${item.category || 'Birthday'}</span>
      </div>
      <h3 class="mt-3 text-xl font-semibold text-copy">${item.name}</h3>
      <p class="mt-2 text-sm leading-6 text-copy-soft">${item.relationship || 'Contact'}</p>
      <div class="mt-4 space-y-2 text-sm leading-6 text-copy-faint">
        ${item.profile ? `<p><span class="text-copy">Profile:</span> ${item.profile}</p>` : ''}
        ${item.interests ? `<p><span class="text-copy">Interests:</span> ${item.interests}</p>` : ''}
        ${item.leadTime ? `<p><span class="text-copy">Prep:</span> ${item.leadTime}</p>` : ''}
      </div>
    </article>
  `
}

function renderProjectDrillCard(item) {
  return `
    <a class="rounded-[26px] border border-line bg-white/[0.04] p-5 transition duration-150 hover:border-fire/25 hover:bg-fire-soft" href="#/projects/${item.data.slug}">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <span class="chip chip-warm">${item.data.status}</span>
        <span class="chip">${capitalize(item.data.priority)} priority</span>
      </div>
      <h3 class="mt-4 text-2xl font-semibold tracking-[-0.03em] text-copy">${item.data.title}</h3>
      <p class="mt-3 text-sm leading-6 text-copy-soft">${item.data.summary}</p>
      <div class="mt-4 rounded-[20px] border border-white/8 bg-black/10 px-4 py-4">
        <p class="micro-label text-copy-faint">Current status</p>
        <p class="mt-2 text-sm leading-6 text-copy">${item.data.nextAction}</p>
      </div>
      <p class="mt-4 text-sm text-fire">Open project detail →</p>
    </a>
  `
}

function buildImmediateMoves(current, projects = []) {
  const moves = []
  const nextItems = Array.isArray(current?.data?.next) ? current.data.next : []

  nextItems.slice(0, 2).forEach((item, index) => {
    moves.push({
      lane: index === 0 ? 'Right now' : 'On deck',
      tag: 'Board move',
      title: item,
      summary: 'Pulled from the live command deck.',
      action: item
    })
  })

  projects
    .filter((project) => String(project.data.priority || '').toLowerCase() === 'high')
    .slice(0, 2)
    .forEach((project) => {
      moves.push({
        lane: humanizeToken(project.data.area || 'project'),
        tag: `${capitalize(project.data.priority || 'active')} priority`,
        title: project.data.title,
        summary: project.data.summary,
        action: project.data.nextAction
      })
    })

  return moves.slice(0, 3)
}

function buildLaneGroups(areas = [], projects = []) {
  return areas
    .map((area) => ({
      label: 'Lane',
      title: area.data.title,
      summary: area.data.summary,
      slug: area.data.slug,
      projects: projects
        .filter((project) => project.data.area === area.data.slug)
        .sort(sortProjects)
        .slice(0, 3)
    }))
    .sort((a, b) => b.projects.length - a.projects.length || a.title.localeCompare(b.title))
}

function buildBirthdayState(birthdays = {}) {
  const upcoming = Array.isArray(birthdays.upcoming) ? birthdays.upcoming.slice().sort((a, b) => a.daysAway - b.daysAway || a.name.localeCompare(b.name)) : []
  const byMonth = {}

  upcoming.forEach((item) => {
    const month = monthSlugFromDateLabel(item.dateLabel)
    byMonth[month] ||= []
    byMonth[month].push(item)
  })

  const monthOrder = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']

  return {
    upcoming,
    byMonth,
    monthOrder
  }
}

function wireRouteBehavior(app, state, route) {
  if (route.name === 'home') {
    const hero = app.querySelector('[data-home-scroll]')
    if (hero) hero.scrollIntoView({ block: 'start' })
  }
}

function parseRoute(hash) {
  const cleaned = String(hash || '#/').replace(/^#/, '') || '/'
  const parts = cleaned.split('/').filter(Boolean)

  if (!parts.length) return { name: 'home' }
  if (parts[0] === 'prompt') return { name: 'prompt' }
  if (parts[0] === 'birthdays' && parts[1]) return { name: 'birthdays', month: parts[1].toLowerCase() }
  if (parts[0] === 'birthdays') return { name: 'birthdays' }
  if (parts[0] === 'pool') return { name: 'pool' }
  if (parts[0] === 'projects' && parts[1]) return { name: 'project', slug: parts[1] }
  if (parts[0] === 'projects') return { name: 'projects' }
  if (parts[0] === 'updates') return { name: 'updates' }
  return { name: 'home' }
}

function renderLink(label, href) {
  const safeLabel = humanizeToken(label)
  const isExternal = /^https?:\/\//i.test(href)

  if (isExternal) {
    return `<a class="chip hover:border-fire/35 hover:bg-fire-soft" href="${href}" target="_blank" rel="noreferrer">${safeLabel}</a>`
  }

  return `<span class="chip">${safeLabel}: ${href}</span>`
}

function renderMarkdownish(content = '') {
  return content
    .split(/\n\n+/)
    .map((block) => {
      const lines = block.split('\n').map((line) => line.trim()).filter(Boolean)
      if (!lines.length) return ''
      if (lines.every((line) => line.startsWith('- '))) {
        return `<ul class="list-dot space-y-2 pl-5 text-sm leading-7 text-copy-soft">${lines.map((line) => `<li>${line.replace(/^-\s*/, '')}</li>`).join('')}</ul>`
      }
      if (lines[0].startsWith('## ')) {
        const title = lines[0].replace(/^##\s*/, '')
        const rest = lines.slice(1).join(' ')
        return `<div class="space-y-2"><h3 class="text-lg font-semibold text-copy">${title}</h3>${rest ? `<p class="text-sm leading-7 text-copy-soft">${rest}</p>` : ''}</div>`
      }
      return `<p class="text-sm leading-7 text-copy-soft">${lines.join(' ')}</p>`
    })
    .join('')
}

function monthSlugFromDateLabel(value = '') {
  return String(value).split(' ')[0].toLowerCase()
}

function humanizeToken(value = '') {
  return value
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function capitalize(value = '') {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : ''
}

function sortProjects(a, b) {
  const priorityRank = { high: 0, medium: 1, low: 2 }
  const statusRank = { active: 0, queued: 1, blocked: 2, paused: 3, idea: 4, complete: 5 }
  return (priorityRank[String(a.data.priority || '').toLowerCase()] ?? 9) - (priorityRank[String(b.data.priority || '').toLowerCase()] ?? 9)
    || (statusRank[String(a.data.status || '').toLowerCase()] ?? 9) - (statusRank[String(b.data.status || '').toLowerCase()] ?? 9)
    || a.data.title.localeCompare(b.data.title)
}

function parseDisplayDate(value) {
  if (typeof value === 'string') {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (match) {
      const [, year, month, day] = match
      return new Date(Number(year), Number(month) - 1, Number(day))
    }
  }

  return new Date(value)
}

function formatCalendarDate(value) {
  const date = parseDisplayDate(value)
  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  })
}

function formatRelativeOrAbsoluteDate(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const diffDays = Math.round((today - target) / 86400000)

  if (diffDays === 0) return 'today'
  if (diffDays === 1) return 'yesterday'

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  })
}

function formatDaysAway(daysAway) {
  if (daysAway === 0) return 'Today'
  if (daysAway === 1) return 'Tomorrow'
  return `${daysAway} days`
}

init()

function renderGratitudeWidget(gratitudeCard = {}) {
  const history = Array.isArray(gratitudeCard.history) ? gratitudeCard.history : []

  return `
    <section class="glass-card p-5 sm:p-6 lg:p-7">
      <div class="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p class="section-kicker">Daily rhythm</p>
          <h2 class="text-2xl font-semibold tracking-[-0.03em] text-copy sm:text-3xl">${gratitudeCard.title || 'Daily gratitude'}</h2>
          <p class="mt-3 max-w-2xl text-sm leading-6 text-copy-soft">${gratitudeCard.subtitle || "Keep today's prompt visible even when you answer it later."}</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <span class="chip chip-warm">${gratitudeCard.statusLabel || 'Pending'}</span>
          ${gratitudeCard.entryId ? `<span class="chip">${gratitudeCard.entryId}</span>` : ''}
          ${gratitudeCard.dateLabel ? `<span class="chip">${gratitudeCard.dateLabel}</span>` : ''}
        </div>
      </div>

      <div class="mt-6 grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <article class="birthday-widget-hero compact-hero">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <p class="micro-label text-fire">Today's prompt</p>
            <span class="chip">${gratitudeCard.sourceLabel || 'Telegram + dashboard'}</span>
          </div>
          <h3 class="mt-4 text-2xl font-semibold tracking-[-0.03em] text-copy">${gratitudeCard.promptTitle || 'Ready when you are'}</h3>
          <p class="mt-4 text-base leading-8 text-copy">${gratitudeCard.prompt || 'No prompt loaded yet.'}</p>

          <div class="mt-5 rounded-[22px] border border-fire/18 bg-black/10 p-4">
            <p class="micro-label text-fire">Use case</p>
            <p class="mt-2 text-sm leading-6 text-copy-soft">${gratitudeCard.note || 'Check it in the morning from Telegram or knock it out later from the dashboard.'}</p>
          </div>

          <div class="mt-5 grid gap-3 sm:grid-cols-2">
            <div class="detail-stat">
              <p class="micro-label text-copy-faint">Status</p>
              <p class="mt-2 text-sm leading-6 text-copy">${gratitudeCard.statusDetail || 'Pending reply'}</p>
            </div>
            <div class="detail-stat">
              <p class="micro-label text-copy-faint">Availability</p>
              <p class="mt-2 text-sm leading-6 text-copy">${gratitudeCard.windowLabel || 'Morning to evening'}</p>
            </div>
          </div>
        </article>

        <div class="grid gap-3">
          <article class="lane-card compact-lane-card">
            <p class="micro-label text-fire">Why it belongs here</p>
            <p class="mt-3 text-sm leading-6 text-copy-soft">This gives you the push in Telegram and the clean fallback on the dashboard, so the prompt stays usable at night without digging through old messages.</p>
          </article>

          <article class="lane-card compact-lane-card">
            <div class="flex items-end justify-between gap-3">
              <div>
                <p class="micro-label text-fire">Recent entries</p>
                <h3 class="mt-3 text-lg font-semibold text-copy">Momentum trail</h3>
              </div>
              <span class="chip">${history.length} loaded</span>
            </div>
            <div class="mt-4 space-y-3">
              ${history.length ? history.map(renderGratitudeHistoryItem).join('') : '<p class="text-sm leading-6 text-copy-soft">No recent gratitude history loaded yet.</p>'}
            </div>
          </article>
        </div>
      </div>
    </section>
  `
}

function renderGratitudeHistoryItem(item) {
  return `
    <article class="birthday-week-item birthday-week-item-compact">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p class="micro-label text-fire">${item.dateLabel || item.date || ''}</p>
          <h4 class="mt-2 text-base font-semibold text-copy">${item.statusLabel || 'Completed'}</h4>
        </div>
        ${item.entryId ? `<span class="chip chip-warm">${item.entryId}</span>` : ''}
      </div>
      ${item.responseSummary ? `<p class="mt-3 text-sm leading-6 text-copy-soft">${item.responseSummary}</p>` : ''}
    </article>
  `
}

function buildGratitudeCard(gratitude = {}) {
  const today = gratitude.today || {}
  const historyLimit = Number(gratitude.settings?.showHistoryCount || 3)
  const history = Array.isArray(gratitude.history) ? gratitude.history.slice(0, historyLimit) : []
  const status = String(today.status || 'pending').toLowerCase()

  return {
    title: gratitude.settings?.title || 'Daily gratitude',
    subtitle: gratitude.settings?.subtitle || "Keep today's prompt visible even when you answer it later at night.",
    promptTitle: status === 'completed' ? "Today's reflection is in" : "Tonight's prompt is waiting",
    prompt: today.prompt,
    entryId: today.entryId,
    dateLabel: formatCalendarDate(today.date),
    sourceLabel: today.source || 'Telegram + dashboard',
    note: today.note,
    statusLabel: status === 'completed' ? 'Completed' : 'Pending',
    statusDetail: status === 'completed'
      ? (today.completedLabel || 'Answered and logged.')
      : 'Visible here until you knock it out.',
    windowLabel: humanizeToken(String(today.availableWindow || 'morning-to-evening')),
    history: history.map((item) => ({
      ...item,
      dateLabel: formatCalendarDate(item.date),
      statusLabel: String(item.status || '').toLowerCase() === 'completed' ? 'Completed' : capitalize(item.status || 'pending')
    }))
  }
}

function renderEventsWidget(eventsCard = {}) {
  const items = Array.isArray(eventsCard.upcoming) ? eventsCard.upcoming : []

  return `
    <section class="stack-card compact-card">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p class="section-kicker">Events & DJ</p>
          <h2 class="text-2xl font-semibold tracking-[-0.03em] text-copy">${eventsCard.title || 'Event lane'}</h2>
          <p class="mt-2 text-sm leading-6 text-copy-soft">${eventsCard.subtitle || 'Upcoming event prep and booked-work visibility.'}</p>
        </div>
        <div class="flex flex-wrap gap-2">
          ${eventsCard.statusLabel ? `<span class="chip chip-warm">${eventsCard.statusLabel}</span>` : ''}
          ${eventsCard.seasonLabel ? `<span class="chip">${eventsCard.seasonLabel}</span>` : ''}
        </div>
      </div>

      <div class="mt-4 grid gap-3">
        ${eventsCard.nextMove ? `
          <article class="rounded-[22px] border border-fire/18 bg-fire-soft p-4">
            <p class="micro-label text-fire">Lane note</p>
            <p class="mt-2 text-sm leading-6 text-copy">${eventsCard.nextMove}</p>
          </article>
        ` : ''}
        ${items.length ? items.map(renderEventItem).join('') : '<article class="rounded-[22px] border border-line bg-white/[0.04] p-4"><p class="text-sm leading-6 text-copy-soft">No upcoming events loaded yet.</p></article>'}
      </div>
    </section>
  `
}

function renderEventItem(item) {
  return `
    <article class="phase-lane-item">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p class="micro-label text-fire">${item.dateLabel || ''}</p>
          <h3 class="mt-2 text-lg font-semibold text-copy">${item.title || 'Upcoming event'}</h3>
          <p class="mt-2 text-sm leading-6 text-copy-soft">${[item.type, item.location].filter(Boolean).join(' · ')}</p>
        </div>
        <div class="flex flex-wrap gap-2">
          ${item.statusLabel ? `<span class="chip chip-warm">${item.statusLabel}</span>` : ''}
          ${item.prepStageLabel ? `<span class="chip">${item.prepStageLabel}</span>` : ''}
        </div>
      </div>
      ${item.nextMove ? `<p class="mt-3 text-sm leading-6 text-copy"><span class="text-copy-faint">Next:</span> ${item.nextMove}</p>` : ''}
      ${item.note ? `<p class="mt-2 text-sm leading-6 text-copy-faint">${item.note}</p>` : ''}
    </article>
  `
}

function renderFitnessWidget(fitnessCard = {}) {
  const recent = Array.isArray(fitnessCard.recent) ? fitnessCard.recent : []

  return `
    <section class="stack-card compact-card">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p class="section-kicker">Personal lane</p>
          <h2 class="text-2xl font-semibold tracking-[-0.03em] text-copy">${fitnessCard.title || 'Workout lane'}</h2>
          <p class="mt-2 text-sm leading-6 text-copy-soft">${fitnessCard.subtitle || 'Training momentum, consistency, and the next session.'}</p>
        </div>
        <div class="flex flex-wrap gap-2">
          ${fitnessCard.statusLabel ? `<span class="chip chip-warm">${fitnessCard.statusLabel}</span>` : ''}
          ${fitnessCard.streakLabel ? `<span class="chip">${fitnessCard.streakLabel}</span>` : ''}
        </div>
      </div>

      <div class="mt-4 grid gap-3 lg:grid-cols-[0.9fr_1.1fr]">
        <article class="birthday-widget-hero compact-hero">
          <p class="micro-label text-fire">Next session</p>
          <h3 class="mt-3 text-xl font-semibold tracking-[-0.03em] text-copy">${fitnessCard.nextTitle || 'Keep moving'}</h3>
          <p class="mt-2 text-sm leading-6 text-copy-soft">${[fitnessCard.nextWindow, fitnessCard.nextDateLabel].filter(Boolean).join(' · ')}</p>
          ${fitnessCard.nextGoal ? `<p class="mt-4 text-sm leading-6 text-copy">${fitnessCard.nextGoal}</p>` : ''}
          ${fitnessCard.nextMove ? `<div class="mt-4 rounded-[20px] border border-fire/18 bg-black/10 px-4 py-4"><p class="micro-label text-fire">Next move</p><p class="mt-2 text-sm leading-6 text-copy-soft">${fitnessCard.nextMove}</p></div>` : ''}
        </article>

        <div class="grid gap-3">
          <article class="lane-card compact-lane-card">
            <p class="micro-label text-fire">Why this lane matters</p>
            <p class="mt-3 text-sm leading-6 text-copy-soft">${fitnessCard.note || 'Keep the body in the operating picture so momentum stays real instead of abstract.'}</p>
          </article>

          <article class="lane-card compact-lane-card">
            <div class="flex items-end justify-between gap-3">
              <div>
                <p class="micro-label text-fire">Recent sessions</p>
                <h3 class="mt-3 text-lg font-semibold text-copy">Consistency trail</h3>
              </div>
              <span class="chip">${recent.length} loaded</span>
            </div>
            <div class="mt-4 space-y-3">
              ${recent.length ? recent.map(renderFitnessHistoryItem).join('') : '<p class="text-sm leading-6 text-copy-soft">No recent workouts loaded yet.</p>'}
            </div>
          </article>
        </div>
      </div>
    </section>
  `
}

function renderFitnessHistoryItem(item) {
  return `
    <article class="phase-lane-item phase-lane-item-compact">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p class="micro-label text-fire">${item.dateLabel || ''}</p>
          <h4 class="mt-2 text-base font-semibold text-copy">${item.title || 'Session'}</h4>
        </div>
        ${item.typeLabel ? `<span class="chip chip-warm">${item.typeLabel}</span>` : ''}
      </div>
      ${item.note ? `<p class="mt-3 text-sm leading-6 text-copy-soft">${item.note}</p>` : ''}
    </article>
  `
}

function buildEventsCard(events = {}) {
  const showCount = Number(events.settings?.showUpcomingCount || 3)
  const upcoming = Array.isArray(events.upcoming) ? events.upcoming.slice(0, showCount) : []

  return {
    title: events.settings?.title || 'Event lane',
    subtitle: events.settings?.subtitle || 'Upcoming DJ work, prep pressure, and the next thing that needs attention before go time.',
    statusLabel: humanizeToken(String(events.summary?.status || 'active')),
    seasonLabel: events.summary?.season,
    nextMove: events.summary?.note,
    upcoming: upcoming.map((item) => ({
      ...item,
      dateLabel: formatCalendarDate(item.date),
      statusLabel: humanizeToken(String(item.status || 'booked')),
      prepStageLabel: humanizeToken(String(item.prepStage || 'prep'))
    }))
  }
}

function buildFitnessCard(fitness = {}) {
  const showCount = Number(fitness.settings?.showRecentCount || 3)
  const recent = Array.isArray(fitness.recent) ? fitness.recent.slice(0, showCount) : []
  const nextSession = fitness.nextSession || {}

  return {
    title: fitness.settings?.title || 'Workout lane',
    subtitle: fitness.settings?.subtitle || 'Training momentum, consistency streak, and the next session that keeps the body moving.',
    statusLabel: humanizeToken(String(fitness.summary?.status || 'active')),
    streakLabel: fitness.summary?.streakLabel,
    note: fitness.summary?.note,
    nextTitle: nextSession.title,
    nextWindow: nextSession.window,
    nextDateLabel: formatCalendarDate(nextSession.targetDate),
    nextGoal: nextSession.goal,
    nextMove: nextSession.nextMove,
    recent: recent.map((item) => ({
      ...item,
      dateLabel: formatCalendarDate(item.date),
      typeLabel: humanizeToken(String(item.type || 'session'))
    }))
  }
}

function buildPoolCard(pool = {}) {
  const summary = pool.summary || {}
  const standings = Array.isArray(pool.standings) ? pool.standings : []

  return {
    title: pool.settings?.title || 'Survivor pool',
    subtitle: pool.settings?.subtitle || 'One pick a week. Survive and advance.',
    seasonLabel: pool.settings ? `${pool.settings.season} ${pool.settings.league}` : '',
    formatLabel: summary.formatLabel || '',
    weekLabel: summary.currentWeek ? `Week ${summary.currentWeek}` : 'Preseason',
    weekStatusLabel: weekStatusCopy(summary.currentWeekStatus),
    deadlineLabel: pool.currentWeek?.deadlineLabel || 'TBD',
    aliveCount: summary.aliveCount ?? 0,
    eliminatedCount: summary.eliminatedCount ?? 0,
    entrantsTotal: summary.entrantsTotal ?? 0,
    potLabel: summary.potLabel || '$0',
    picksIn: summary.picksIn ?? 0,
    picksNeeded: summary.picksNeeded ?? 0,
    championName: summary.championName || null,
    leaders: standings.slice(0, 4),
    hasEntrants: standings.length > 0,
    warningCount: (pool.warnings || []).length
  }
}

function renderPoolWidget(poolCard = {}) {
  const pickProgress = poolCard.picksNeeded
    ? `${poolCard.picksIn}/${poolCard.picksNeeded} picks in`
    : 'No picks needed yet'

  return `
    <section class="stack-card compact-card">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p class="section-kicker">Survivor pool</p>
          <h2 class="text-2xl font-semibold tracking-[-0.03em] text-copy">${escapeHtml(poolCard.title)}</h2>
          <p class="mt-2 text-sm leading-6 text-copy-soft">${escapeHtml(poolCard.subtitle)}</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <span class="chip chip-warm">${escapeHtml(poolCard.weekLabel)}</span>
          <span class="chip">${escapeHtml(poolCard.potLabel)} pot</span>
        </div>
      </div>

      <div class="mt-4 grid gap-3">
        <article class="rounded-[22px] border border-fire/18 bg-fire-soft p-4">
          <p class="micro-label text-fire">${escapeHtml(poolCard.weekStatusLabel)}</p>
          <p class="mt-2 text-sm leading-6 text-copy">
            ${poolCard.championName
              ? `<strong>${escapeHtml(poolCard.championName)}</strong> is the last player standing.`
              : `${poolCard.aliveCount} alive · ${poolCard.eliminatedCount} out · ${pickProgress}.`}
          </p>
          <p class="mt-2 text-sm leading-6 text-copy-faint">Picks lock ${escapeHtml(poolCard.deadlineLabel)}.</p>
        </article>

        ${poolCard.hasEntrants
          ? `<div class="grid gap-3">${poolCard.leaders.map((entrant) => renderPoolEntrantRow(entrant, true)).join('')}</div>`
          : '<article class="rounded-[22px] border border-line bg-white/[0.04] p-4"><p class="text-sm leading-6 text-copy-soft">No entrants yet. Add players with <code>npm run pool -- --add-entrant="Name"</code>.</p></article>'}

        <a class="chip justify-center" href="#/pool">Open the full pool board →</a>
      </div>
    </section>
  `
}

function renderPoolRoute(state) {
  const pool = state.pool || {}
  const summary = pool.summary || {}
  const settings = pool.settings || {}
  const standings = Array.isArray(pool.standings) ? pool.standings : []
  const weeks = Array.isArray(pool.weeks) ? pool.weeks : []
  const warnings = Array.isArray(pool.warnings) ? pool.warnings : []
  const current = pool.currentWeek

  return `
    <section class="stack-card compact-card">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p class="section-kicker">Survivor pool</p>
          <h2 class="text-3xl font-semibold tracking-[-0.03em] text-copy">${escapeHtml(settings.title || 'Survivor pool')}</h2>
          <p class="mt-2 max-w-2xl text-sm leading-6 text-copy-soft">${escapeHtml(settings.subtitle || '')}</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <a class="chip" href="#/">Back to overview</a>
          <span class="chip chip-warm">${escapeHtml(summary.formatLabel || '')}</span>
          <span class="chip">${escapeHtml(String(settings.season || ''))} ${escapeHtml(settings.league || '')}</span>
        </div>
      </div>
    </section>

    <section class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      ${renderStatCard('Still alive', summary.aliveCount ?? 0, `${summary.entrantsTotal ?? 0} entered this season.`)}
      ${renderStatCard('Eliminated', summary.eliminatedCount ?? 0, `${settings.strikesToEliminate ?? 2} strikes ends a run.`)}
      ${renderStatCard(summary.currentWeek ? `Week ${summary.currentWeek}` : 'Preseason', `${summary.picksIn ?? 0}/${summary.picksNeeded ?? 0}`, `Picks in. Locks ${escapeHtml(current?.deadlineLabel || 'TBD')}.`)}
      ${renderStatCard('Pot', summary.potLabel || '$0', `${escapeHtml(formatMoneyish(settings.entryFee, settings.currency))} per entry.`)}
    </section>

    ${warnings.length ? `
      <section class="stack-card compact-card">
        <p class="section-kicker">Commissioner attention</p>
        <h3 class="text-2xl font-semibold tracking-[-0.03em] text-copy">${warnings.length} thing${warnings.length === 1 ? '' : 's'} to resolve</h3>
        <div class="mt-4 grid gap-3">
          ${warnings.map((warning) => `
            <article class="rounded-[22px] border border-amber-400/25 bg-amber-400/10 p-4">
              <p class="text-sm leading-6 text-copy">${escapeHtml(warning.message)}</p>
            </article>
          `).join('')}
        </div>
      </section>
    ` : ''}

    <section class="grid items-start gap-4 xl:grid-cols-[1.25fr_0.75fr]">
      <section class="stack-card compact-card">
        <div class="mb-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p class="section-kicker">Standings</p>
            <h3 class="text-2xl font-semibold tracking-[-0.03em] text-copy">Who is still breathing</h3>
            <p class="mt-2 text-sm leading-6 text-copy-soft">Strikes, teams already burned, and how much roster is left.</p>
          </div>
          <span class="chip chip-warm">${standings.length} entrant${standings.length === 1 ? '' : 's'}</span>
        </div>
        <div class="grid gap-3">
          ${standings.length
            ? standings.map((entrant) => renderPoolEntrantRow(entrant)).join('')
            : '<article class="rounded-[22px] border border-line bg-white/[0.04] p-4"><p class="text-sm leading-6 text-copy-soft">No entrants yet. Add players with <code>npm run pool -- --add-entrant="Name"</code>, then rebuild.</p></article>'}
        </div>
      </section>

      <section class="stack-card compact-card">
        <div class="mb-4">
          <p class="section-kicker">The rules</p>
          <h3 class="text-2xl font-semibold tracking-[-0.03em] text-copy">How this pool works</h3>
        </div>
        <div class="grid gap-3">
          ${(pool.rules || []).map((rule) => `
            <article class="lane-card compact-lane-card">
              <p class="micro-label text-fire">${escapeHtml(rule.title)}</p>
              <p class="mt-2 text-sm leading-6 text-copy-soft">${escapeHtml(rule.body)}</p>
            </article>
          `).join('')}
        </div>
      </section>
    </section>

    ${current ? `
      <section class="stack-card compact-card">
        <div class="mb-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p class="section-kicker">This week</p>
            <h3 class="text-2xl font-semibold tracking-[-0.03em] text-copy">Week ${current.week} board</h3>
            <p class="mt-2 text-sm leading-6 text-copy-soft">${escapeHtml(weekStatusCopy(current.status))} · locks ${escapeHtml(current.deadlineLabel)}.</p>
          </div>
          <span class="chip chip-warm">${current.picksIn} pick${current.picksIn === 1 ? '' : 's'} in</span>
        </div>
        ${current.picks.length ? `
          <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            ${current.picks.map((pick) => `
              <article class="phase-lane-item phase-lane-item-compact">
                <p class="micro-label text-fire">${escapeHtml(pick.name)}</p>
                <p class="mt-2 text-lg font-semibold text-copy">${escapeHtml(pick.teamName)}</p>
                <p class="mt-1 text-sm leading-6 text-copy-faint">${pick.result ? escapeHtml(capitalize(pick.result)) : 'Awaiting result'}</p>
              </article>
            `).join('')}
          </div>
        ` : '<p class="text-sm leading-6 text-copy-soft">No picks submitted yet this week.</p>'}
      </section>
    ` : ''}

    <section class="grid gap-4 xl:grid-cols-[1fr_1fr]">
      <section class="stack-card compact-card">
        <div class="mb-4 flex items-end justify-between gap-4">
          <div>
            <p class="section-kicker">Season</p>
            <h3 class="text-2xl font-semibold tracking-[-0.03em] text-copy">Week by week</h3>
          </div>
          <span class="chip">${summary.weeksPlayed ?? 0} of ${weeks.length} final</span>
        </div>
        <div class="grid gap-2 sm:grid-cols-2">
          ${weeks.map((week) => renderPoolWeekChip(week)).join('')}
        </div>
      </section>

      <section class="stack-card compact-card">
        <div class="mb-4 flex items-end justify-between gap-4">
          <div>
            <p class="section-kicker">Team board</p>
            <h3 class="text-2xl font-semibold tracking-[-0.03em] text-copy">One-time use tracker</h3>
            <p class="mt-2 text-sm leading-6 text-copy-soft">How many entrants have already spent each team.</p>
          </div>
        </div>
        <div class="grid gap-2 sm:grid-cols-2">
          ${(pool.teamUsage || []).map((team) => `
            <div class="flex items-center justify-between gap-3 rounded-[18px] border ${team.usedCount ? 'border-fire/25 bg-fire-soft' : 'border-line bg-white/[0.04]'} px-3 py-2">
              <span class="text-sm text-copy">${escapeHtml(team.name)}</span>
              <span class="text-xs font-semibold ${team.usedCount ? 'text-fire' : 'text-copy-faint'}">${team.usedCount ? `${team.usedCount} used` : 'open'}</span>
            </div>
          `).join('')}
        </div>
      </section>
    </section>
  `
}

function renderPoolEntrantRow(entrant, compact = false) {
  const toneClass = entrant.status === 'eliminated'
    ? 'border-line bg-white/[0.02] opacity-70'
    : entrant.status === 'winner'
      ? 'border-fire/35 bg-fire-soft'
      : 'border-line bg-white/[0.04]'

  return `
    <article class="rounded-[22px] border ${toneClass} p-4">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0">
          <h4 class="text-lg font-semibold text-copy">${escapeHtml(entrant.name)}${entrant.status === 'winner' ? ' 🏆' : ''}</h4>
          <p class="mt-1 text-sm leading-6 text-copy-soft">${escapeHtml(entrant.statusLabel)}</p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          ${renderStrikePips(entrant)}
          <span class="chip">${entrant.teamsRemaining} teams left</span>
        </div>
      </div>
      ${compact ? '' : `
        <p class="mt-3 text-sm leading-6 text-copy-faint">${escapeHtml(entrant.lastOutcomeLabel)}</p>
        ${entrant.teamsUsed.length ? `
          <div class="mt-3 flex flex-wrap gap-2">
            ${entrant.teamsUsed.map((team) => `<span class="chip">${escapeHtml(team.name)}</span>`).join('')}
          </div>
        ` : '<p class="mt-3 text-sm leading-6 text-copy-faint">No teams burned yet — all 32 still available.</p>'}
      `}
    </article>
  `
}

function renderStrikePips(entrant) {
  const total = entrant.strikesToEliminate || 1
  const pips = Array.from({ length: total }, (_, index) =>
    `<span class="${index < entrant.strikes ? 'text-fire' : 'text-copy-faint'}">${index < entrant.strikes ? '●' : '○'}</span>`
  ).join('')

  return `<span class="chip ${entrant.strikes ? 'chip-warm' : ''}" title="${entrant.strikes} of ${total} strikes">${pips} ${entrant.strikes}/${total}</span>`
}

function renderPoolWeekChip(week) {
  const tone = week.isCurrent
    ? 'border-fire/35 bg-fire-soft'
    : week.status === 'final'
      ? 'border-line bg-white/[0.06]'
      : 'border-line bg-white/[0.02]'

  return `
    <div class="rounded-[18px] border ${tone} px-3 py-2">
      <div class="flex items-center justify-between gap-3">
        <span class="text-sm font-semibold text-copy">Week ${week.week}</span>
        <span class="text-xs ${week.isCurrent ? 'text-fire' : 'text-copy-faint'}">${escapeHtml(week.statusLabel)}</span>
      </div>
      <p class="mt-1 text-xs text-copy-faint">${week.status === 'final'
        ? `${week.survivors} survived · ${week.casualties} struck`
        : `Locks ${escapeHtml(week.deadlineLabel)}`}</p>
    </div>
  `
}

function weekStatusCopy(status) {
  if (status === 'final') return 'Week final'
  if (status === 'open') return 'Picks open'
  return 'Not open yet'
}

function formatMoneyish(amount, currency = 'USD') {
  const value = Number(amount) || 0
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value)
  } catch {
    return `${value} ${currency}`
  }
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
