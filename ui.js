let HOLDED, TARGET
const setHolded = newHolded => {
  const style = HOLDED?.style
  style && (style.transform = '')
  HOLDED = newHolded
}

const calc = n => `calc(var(--n)*${n})`
const setTargeted = newTarget =>
  newTarget === TARGET || (board.dataset.target = TARGET = newTarget)

const { div, p, span } = Stack.h
const CSS = []
const arr10 = [...Array(10).keys()]
const N = n => arr10.slice(0, n)

// handle all interactions with the dom
// - css
// reading / writing to the dom
// triggering events


// SCALABLE EMOJI + TEXT
const inline = (emoji) =>
  `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 190 190' style='font-size: 120px'%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle'%3E${emoji}%3C/text%3E%3C/svg%3E")`

const inlineText = n =>
  `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 140 140' style='font-size: 120px;font-family: monospace;font-weight: bold'%3E%3Ctext x='50%25' y='58%25' dominant-baseline='middle' text-anchor='middle'%3E${n}%3C/text%3E%3C/svg%3E")`

const icon = (emoji, bgHex = '391f0c8a') => `
.card .${[...emoji][0]}, .card .${emoji} {
  background-color: #${bgHex};
  background-image: ${inline(emoji)};
}`

CSS.push(`
.card.age1.back { background: #634339 }
.card.age2.back { background: #256f8d }
.card.age3.back { background: #483963 }

#board:not([data-age="1"]) .card.age1 { display: none }
#board:not([data-age="2"]) .card.age2 { display: none }
#board:not([data-age="3"]) .card.age3 { display: none }

${N(10).map(n => `.card .💵${n} {
  background-color: gold;
  font-size: 200%;
  background-image: ${inlineText(n)};
}`).join('\n')}

${N(10).map(n => `.card .💎${n} {
  background-color: #5ed492;
  font-size: 200%;
  background-image: ${inlineText(n)};
}`).join('\n')}

${icon('⚔️')}
${icon('🧱', 'cd5128')}
${icon('⛰️', '97999b')}
${icon('🌲', '8ab754')}
${icon('🧵', '62bef5')}
${icon('📜', 'd3a77c')}

${icon('⚗️')}
${icon('📚')}
${icon('✒️')}
${icon('⚙️')}
${icon('⚖️')}
${icon('🔭')}
${icon('📐')}

.card.🟤 .effects { background-color: #97513c } /* ■ */
.card.⚪ .effects { background-color: #7c7e81 } /* ⧫ */
.card.🔵 .effects { background-color: #0086cb } /* ❚ */
.card.🔴 .effects { background-color: #c4151e } /* 🗙 */
.card.🟢 .effects { background-color: #008843 } /* ▲ */
.card.🟡 .effects { background-color: #f4ac23 } /* ⬤ */
.card.🟣 .effects { background-color: #815089 } /* ★ */
`)

// Y = vertical, X = horizontal
const checkBounds = (width, top, left, x, y) =>
  y > top  && true &&
  x > left && x < left + width

const findTarget = (x, y, width) => {
  if (!HOLDED) return setTargeted('')
  const lower = width / 10 // lower elements height
  const half = width / 2 // player zone width
  const quarter = width / 4 // bank width
  const eighth = width / 8 // wonders width

    checkBounds(width / 4, width - lower, -1, x, y)
  ? setTargeted('wonders-0')

  : checkBounds(width / 4 + 1, width - lower, width - quarter, x, y)
  ? setTargeted('wonders-1')

  : checkBounds(width / 4, width - lower, half - eighth, x, y)
  ? setTargeted('bank')

  : checkBounds(half, half, -1, x, y)
  ? setTargeted('zone-0')

  : checkBounds(half + 1, half, half, x, y)
  ? setTargeted('zone-1')

  : setTargeted('')
}

const calcTop = y => y * 6
const calcLeft = (x, y) => x*16 + (y%2)*8
const moveFrom = (mx, my, width) => {
  findTarget(mx, my, width)
  const vw = width / 100
  if (!HOLDED || mx < 0 && my < 0) return
  const { x, y } = HOLDED.card.slot

  const size = (15/2)*vw
  const top = (calcTop(y) + 1.75)* vw + size
  const left = (calcLeft(x, y) + 1.75) * vw + size

  HOLDED.style.transform = `translate(${mx-left}px, ${my-top}px)`
}

CSS.push(...[...Game.slots.values()].map(({key, x, y}) => `

.${key} {
  top: ${calc(calcTop(y) + 1.5)};
  left: ${calc(calcLeft(x, y) + 1.5)};
  transform: scale(1);
}

#board[data-interaction="hover${key}"][data-turn="0"] .card.${key} {
  cursor: not-allowed;
}

#board[data-interaction="hover${key}"] .card.${key} {
  position: absolute;
  transition: transform 200ms cubic-bezier(0, 1.3, 0.5, 1);
  transform: scale(1.2);
  cursor: grab;
  z-index: 10;
}

#board[data-interaction="hold${key}"] .card.${key} {
  opacity: 0.8;
  cursor: grabbing;
  z-index: 500!important;
}
`))

const board = div({ id: 'board' })
CSS.push(`
#board {
  margin: 0 auto;
  width: ${calc(100)};
  height: ${calc(100)};
  position: relative;
  background: #222;
  overflow: hidden;
  display: flex;
  flex-wrap: wrap;
}`)

const cardsWrapper = div({ id: 'cardsWrapper' })
CSS.push(`
#board[data-age="1"] #cardsWrapper {
  background-image: linear-gradient(to bottom, #634339, #0000);
}
#board[data-age="2"] #cardsWrapper {
  background-image: linear-gradient(to bottom, #256f8d, #0000);
}
#board[data-age="3"] #cardsWrapper {
  background-image: linear-gradient(to bottom, #483963, #0000);
}
#cardsWrapper {
  width: 100%;
  height: ${calc(50)};
}
`)

const P0Zone = div({ id: `zone-0` })
const P1Zone = div({ id: `zone-1` })
CSS.push(`
#board[data-player="1"] #zone-1,
#board[data-player="0"] #zone-0 {
  background-color: #273343;
  box-shadow: inset 0 0 var(--n) ${calc(2.5)} #222;
  border-radius: 10%;
}

#zone-1, #zone-0 {
  width: 50%;
  height: ${calc(40)};
}
`)

const bottomWrapper = div({ id: 'bottomWrapper' })
CSS.push(`
#bottomWrapper {
  width: 100%;
  height: ${calc(10)};
  display: grid;
  grid-template-columns: 1fr 2fr 1fr 1fr 2fr 1fr;
  grid-template-rows: 1fr 0.25fr;
  grid-column-gap: 0px;
  grid-row-gap: 0px;
}
`)

const P0Wonders = div({ id: `wonders-0` })
const P1Wonders = div({ id: `wonders-1` })
CSS.push(`
#wonders-1, #wonders-0 {
  background-position: center;
  background-repeat: no-repeat;
}
#wonders-0 {
  grid-area: 1 / 1 / 3 / 2;
  background-image: ${inline('🕌')}, radial-gradient(ellipse at bottom left, #f80, #222, transparent);
}
#wonders-1 {
  grid-area: 1 / 6 / 3 / 7;
  background-image: ${inline('🛕')}, radial-gradient(ellipse at bottom right, #f80, #222, transparent);
}
`)

const P0Hub = div({ id: `hub-0` })
const P1Hub = div({ id: `hub-1` })
CSS.push(`
#hub-0 { grid-area: 1 / 2 / 2 / 3 }
#hub-1 { grid-area: 1 / 5 / 2 / 6 }
#hub-1, #hub-0 {
}
`)

const bank = div({ id: 'bank' })
CSS.push(`
#bank {
  grid-area: 1 / 3 / 2 / 5;
  background-image: ${inlineText('💵')}, radial-gradient(ellipse at bottom, #f80, #222, transparent);
  background-position: center;
  background-repeat: no-repeat;
}
`)

const warProgress = div({ id: 'war-progress' }, [
  N(8).map(n => div({ id: `war-0-${8-n}`, className: 'step' })),
  div({ className: 'step active' }),
  N(8).map(n => div({ id: `war-1-${n+1}`, className: 'step' })),
])
CSS.push(`
#war-progress .step.active { background-color: #c4151e }
#war-progress .step {
  background-color: #28170a;
  position: relative;
  width: ${calc(4)};
}

#war-progress {
  background: #000;
  grid-area: 2 / 2 / 3 / 6;
  display: flex;
  border: ${calc(1/2)} solid #000;
  justify-content: space-between;
}
`)

const ActivePlayerTurnOnly = target => N(2)
  .flatMap(p => N(2).map(t => [p, t, `${target}-${Number(p === t)}`]))
  .map(([p, t, id]) => `#board[data-player="${p}"][data-turn="${t}"][data-target="${id}"] #${id}`)

// Intractivity
CSS.push(`
${ActivePlayerTurnOnly('wonders').join(',\n')},
${ActivePlayerTurnOnly('zone').join(',\n')},
#board[data-target="bank"] #bank {
  outline: #fff5 ${calc(1/3)} dashed;
  outline-offset: ${calc(-1)};
}
`)

bottomWrapper.append(P0Wonders, P1Wonders, P0Hub, P1Hub, bank, warProgress)

const Card = (props, i) => {
  const { age, type, name, effects, cost, index, slot } = props
  const className = `card ${type} age${age} ${slot.key} ${slot.y % 2 ? 'back' : ''}`
  const onmousedown = (e) => {
    if (!Game.state.turn.get()) return
    setHolded(props.element)
  }

  const el = div({ className, onmousedown }, [
    CardEffects(effects),
    CardCost(cost, name),
  ])
  el.card = props
  props.element = el
  return el
}

const shadow = `
  0 ${calc(-2)} ${calc(3)} ${calc(-1.8)} #0006,
  0 ${calc(1/4)} var(--n) #0008`

CSS.push(`
.card {
  width:  ${calc(15)};
  height: ${calc(15)};
  background: white;
  border-radius: var(--n);
  overflow: hidden;
  margin: var(--n);
  position: absolute;
  box-shadow: ${shadow};
  transition: transform 200ms cubic-bezier(0, 1.3, 0.5, 1), z-index 50ms;
  z-index: 0;
}
.card *, .card { user-select: none }
.card.back .effects,
.card.back .cost { visibility: hidden }
.card.back {
  background: #000;
  box-shadow:
    ${shadow},
    inset 0px ${calc(-2)} ${calc(3)} ${calc(-1.8)} #ffd36b7a,
    inset 0px ${calc(2) }  var(--n)  ${calc(-1.8)} #ffdda05e;
}
.card.back:after {
  content: ' ';
  width: 100%;
  height: 100%;
  display: block;
  position: absolute;
  top: 0;
  box-shadow: inset 0px 0px 0 ${calc(2)} #0006;
}

#board[data-turn="0"] .card, .card.back { pointer-events: none }

.card p {
  height: 50%;
  display: flex;
  justify-content: center;
}
`)


const CardEffect = e => div({ className: `effect ${e.type}${e.amount || ''}` })
const CardEffects = (effects = []) => p(
  { className: 'effects' },
  effects.map(CardEffect),
)

CSS.push(`
.card .effects {
  display: flex;
  justify-content: center;
  align-items: center;
  box-shadow:
    inset 0px ${calc(-2)} ${calc(3)} ${calc(-1.8)} #e4b254,
    inset 0px ${calc(2) }  var(--n)  ${calc(-1.8)} #ffdda0;
}

.card .effect {
  width: 25%;
  height: 50%;
  margin-top: 2%;
  margin-right: 2%;
  border-radius: 100%;
  background-repeat: no-repeat;
}`)

const CardResource = r =>
  div({ className: `resource ${r.type}${r.amount || ''}`})

const CardCost = (cost = [], name) => p({ className: 'cost' }, [
  ...cost.map(CardResource),
  span(name),
])

CSS.push(`
.card .cost {
  flex-wrap: wrap;
  align-content: center;
  box-shadow: inset 0px ${calc(-2)} ${calc(3)} ${calc(-1.8)} #ffd36b;
}

.card .cost span {
  width: 100%;
  flex-shrink: 0;
  display: inline-block;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card .cost .resource:first-child { margin: 1.6% }
.card .cost .resource {
  width: 18%;
  height: 36%;
  margin-top: 1.6%;
  margin-right: 1.6%;
  border-radius: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: hidden;
  background-repeat: no-repeat;
  flex-shrink: 0;
}`)



const Wonder = () => {
  const d = Stack.h.div({})

}
CSS.push(`
.wonder {
  width: 200px;
  height: 260px;
  image-rendering: pixelated;
  background-image: url(data:image/png;base64,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);
  background-size: cover;
}
`)

const cursorEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
cursorEl.id = 'enemyCursor'
cursorEl.setAttribute('width', 24)
cursorEl.setAttribute('height', 24)
cursorEl.setAttribute('viewBox', '-5 -5 35 35')
cursorEl.innerHTML = `
  <defs><filter id="s"><feDropShadow stdDeviation="2"/></filter></defs>
  <path d="M4 0l16 12.279-6.951 1.17 4.325 8.817-3.596 1.734-4.35-8.879-5.428 4.702z" style="filter:url(#s)"/>
`
CSS.push(`
#enemyCursor {
  stroke: #fff;
  stroke-width: 2px;
  stroke-linecap: butt;
  stroke-linejoin: miter;
  position: absolute;
  pointer-events: none;
  z-index: 1000;
}
`)

board.append(cursorEl)
const boardPosition = Stack.reader(() => board.getBoundingClientRect())


// mouse tracking
const nearestCardMap = new WeakMap
const { cursor, interaction } = Game.state
let clicked
const setMouse = (e, name) => {
  const { top, left, width } = boardPosition.get()
  const x = Math.max(Math.min(e.x - left, width), 0)
  const y = Math.max(Math.min(e.y - top,  width), 0)
  cursor.set([x/width, y/width])

  // clear holded if left click isn't pressed
  name === 'mouseover' || (e.buttons & 1) || setHolded(null)
  const pad = HOLDED ? 100 : 0
  const hover = HOLDED || nearestCardMap.get(e.target)
  interaction.set(hover ? hover.card.index + pad : 200)
}

addEventListener('mouseover', e => setMouse(e, 'mouseover'), false)
addEventListener('mousemove', e => setMouse(e, 'mousemove'), false)
addEventListener('mousedown', e => setMouse(e, 'mousedown'), false)
addEventListener('mouseup',   e => setMouse(e, 'mouseup'), false)

const handleInteraction = (interaction, s) => {
  if (interaction < 100) {
    const card = Game.cards[interaction]
    setHolded(null)
    board.dataset.interaction = `hover${card.slot.key}`
  } else if (interaction < 200) {
    const card = Game.cards[interaction-100]
    setHolded(card.element)
    board.dataset.interaction = `hold${card.slot.key}`
  } else {
    setHolded(null)
    board.dataset.interaction = ''
  }
}

const handleCursor = (data, el) => {
  const { width } = boardPosition.get()
  const x = Math.round(data[0]*width)
  const y = Math.round(data[1]*width)
  el && (el.style.transform = `translate(${x-7}px, ${y-6}px)`)
  moveFrom(x, y, width)
}

Game.state.interaction.on(e => handleInteraction(e, 'normal'))
Game.state.enemyInteraction.on(e => handleInteraction(e, 'enemy'))
Game.state.cursor.on(data => handleCursor(data)) // meh
Game.state.enemyCursor.on(data => handleCursor(data, cursorEl))

Stack.css(`
:root { --n: 1vh }
@media (orientation: portrait) {
  :root { --n: 1vw }
}

html, body {
  height: 100vh;
  background: #111;
  font-family: monospace;
  display: flex;
  justify-content: center;
  align-items: center;
}

${CSS.join('\n')}
`)


// TODO:
// host generate and send initial Game.state of the game
// 

board.append(cardsWrapper, P0Zone, P1Zone, bottomWrapper)
document.body.append(board)

Game.state.turn.on(turn => board.dataset.turn = turn)
Game.state.player.on(player => board.dataset.player = player)
Game.state.moves.on(moves => {
  // 0 = player 1 pick 1 wonder (round 1)
  // 1 = player 2 pick 2 wonders, last is given to player 1
  // 2 = player 2 pick 1 wonder (round 2)
  // 3 = player 1 pick 2 wonders, last is given to player 2
  // 4 = player 1 pick first card

  board.dataset.age = Math.min(Math.ceil((moves.length - 3) / 20), 0) || 1
})

// New deck = new game
Game.state.deck.on(deck => {
  if (!deck) return
  Stack.replace(cardsWrapper, deck.map(Card))

  // pre-compute once closest card for sub elements
  for (const el of document.querySelectorAll('.card *')) {
    nearestCardMap.set(el, el.closest('.card'))
  }

})

// loadAge(1)
