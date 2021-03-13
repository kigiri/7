import { exportJS } from './nostack.js'

// GAME DATA
// helper functions to make the card declaration less tedious for now
// could be generated in a big JSON and deleted
const arr10 = [...Array(10).keys()]
const N = n => arr10.slice(0, n)
const point = amount => ({ effects: [ { type: '💎', amount } ] })
const military = amount => ({ effects: [...Array(amount).keys()].map(() => ({ type: '⚔' })) })
const toFX = r => /[0-9]/.test(String(r))
  ? { type: '💵', amount: Number(r) }
  : { type: r }

const expand = resources => typeof resources === 'number'
  ? [ toFX(resources) ]
  : [...resources].map(toFX)

const cost = resources => ({ cost: expand(resources) })
const resource = resources => ({ effects: expand(resources) })
const discount = resources => ({
  effects: expand(resources)
    .map(({ type }) => ({ type, mode: 'discount' })),
})

const science = resources => ({
  effects: expand(resources)
    .map(r => r.type === '💵' ? { ...r, type: '💎' } : r)
})

let MAX_CARD = 0
const card = age => (type, name, ...props) =>
  ({ age, name, type, ...Object.assign({}, ...props), index: MAX_CARD++ })

const I = card(1)
const II = card(2)
const III = card(3)

const cards = [
  I('🟤', 'Lumber Yard', resource('🌲')),
  I('🟤', 'Logging Camp', resource('🌲'), cost(1)),
  I('🟤', 'Clay Pool', resource('🧱')),
  I('🟤', 'Clay Pit', resource('🧱'), cost(1)),
  I('🟤', 'Quarry', resource('⛰')),
  I('🟤', 'Stone Pit', resource('⛰'), cost(1)),
  I('⚪', 'Loom', resource('🧵'), cost(1)),
  I('⚪', 'Press', resource('📜'), cost(1)),
  I('🔵', 'Theater', point(3)),
  I('🔵', 'Altar', point(3)),
  I('🔵', 'Baths', point(3), cost('⛰')),
  I('🔴', 'Guard Tower', military(1)),
  I('🔴', 'Stable', military(1), cost('🌲')),
  I('🔴', 'Garrison', military(1), cost('🧱')),
  I('🔴', 'Palisade', military(1), cost(2)),
  I('🟢', 'Workshop', science('📐'), cost('📜')),
  I('🟢', 'Apothecary', science('⚙'), cost('🧵')),
  I('🟢', 'Scriptorium', science('✒'), cost(2)),
  I('🟢', 'Pharmacist', science('⚗'), cost(2)),
  I('🟡', 'Stone Reserve', discount('⛰'), cost(3)),
  I('🟡', 'Clay Reserve', discount('🧱'), cost(3)),
  I('🟡', 'Wood Reserve', discount('🌲'), cost(3)),
  I('🟡', 'Tavern', resource(4)),

  II('🟤', 'Sawmill', resource('🌲🌲'), cost(2)),
  II('🟤', 'Brickyard', resource('🧱🧱'), cost(2)),
  II('🟤', 'Shelf Quarry', resource('⛰⛰'), cost(2)),
  II('⚪', 'Dyehouse', resource('🧵')),
  II('⚪', 'Drying Room', resource('📜')),
  II('🔵', 'Tribunal', point(5), cost('🌲🌲🧵')),
  II('🔵', 'Statue', point(4), cost('🧱🧱')),
  II('🔵', 'Temple', point(4), cost('🌲📜')),
  II('🔵', 'Aqueduct', point(5), cost('⛰⛰⛰')),
  II('🔵', 'Rostrum', point(4), cost('⛰🌲')),
  II('🔴', 'Walls', military(2), cost('⛰⛰')),
  II('🔴', 'Horse Breeders', military(1), cost('🧱🌲')),
  II('🔴', 'Barracks', military(1), cost(3)),
  II('🔴', 'Archery Range', military(2), cost('⛰🌲📜')),
  II('🔴', 'Parade Ground', military(2), cost('🧱🧱🧵')),
  II('🟢', 'Library', science('✒2'), cost('⛰🌲🧵')),
  II('🟢', 'Dispensary', science('⚗2'), cost('🧱🧱⛰')),
  II('🟢', 'School', science('⚙1'), cost('🌲📜📜')),
  II('🟢', 'Laboratory', science('📐1'), cost('🌲🧵🧵')),
  II('🟡', 'Forum', resource('🧵📜'), cost('3🧱')),
  II('🟡', 'Caravansery', resource('🌲🧱⛰'), cost('2🧵📜')),
  II('🟡', 'Customs House', discount('🧵📜'), cost(4)),
  II('🟡', 'Brewery', resource(6)),

  III('🔵', 'Palace', point(7), cost('🧱⛰🌲🧵🧵')),
  III('🔵', 'Town hall', point(7), cost('⛰⛰⛰🌲🌲')),
  III('🔵', 'Obelisk', point(5), cost('⛰⛰🧵')),
  III('🔵', 'Gardens', point(6), cost('🧱🧱🌲🌲')),
  III('🔵', 'Pantheon', point(6), cost('🧱🌲📜📜')),
  III('🔵', 'Senate', point(5), cost('🧱🧱⛰📜')),
  III('🔴', 'Arsenal', military(3), cost('🧱🧱🧱🌲🌲')),
  III('🔴', 'Pretorium', military(3), cost(8)),
  III('🔴', 'Fortifications', military(2), cost('⛰⛰🧱📜')),
  III('🔴', 'Siege Workshop', military(2), cost('🌲🌲🌲🧵')),
  III('🔴', 'Circus', military(2), cost('🧱🧱⛰⛰')),
  III('🟢', 'Academy', science('📚3'), cost('⛰🌲🧵🧵')),
  III('🟢', 'Study', science('📚3'), cost('🌲🌲🧵📜')),
  III('🟢', 'University', science('🔭2'), cost('🧱🧵📜')),
  III('🟢', 'Observatory', science('🔭2'), cost('⛰📜📜')),
  III('🟡', 'Chamber of Commerce', resource(1)),
  III('🟡', 'Port', resource(1)),
  III('🟡', 'Armory', resource(1)),
  III('🟡', 'Lighthouse', resource(1)),
  III('🟡', 'Arena', resource(1)),

// III('🟣', 'arena', resource(1)),
]

// BALANCE:
// Pyramid gives now 11 victory points (buffed from 9)
// 2nd player get 1 more gold

const wonders = [
  { name: 'Appian Way', ...cost(1) },
  { name: 'Circus Maximus', ...cost(1) },
  { name: 'Colossus', ...cost(1) },
  { name: 'Great Library', ...cost(1) },
  { name: 'Great Lighthouse', ...cost(1) },
  { name: 'Hanging Gardens', ...cost(1) },
  { name: 'Mausoleum', ...cost(1) },
  { name: 'Pyraeus', ...cost(1) },
  { name: 'Pyramids', ...cost(1) },
  { name: 'Sphinx', ...cost(1) },
  { name: 'Statue Zeus', ...cost(1) },
  { name: 'Temple Artemis', ...cost(1) },
]

// STAGGERED GRID SLOTS
const slots = new Map(N(6).flatMap(x => N(7).map(y => {
  const i = y*6 + x
  const key = `_${i.toString(36)}`
  const bottomRight = x !== 5 && `_${(i + 6 + (y % 2)).toString(36)}` || undefined
  const bottomLeft = (x + y%2) && `_${(i + 5 + (y % 2)).toString(36)}` || undefined
  const slot = { key, i, x, y, bottomRight, bottomLeft }
  return [key, slot]
})))

for (const { key, bottomRight, bottomLeft } of slots.values()) {
  slots.has(bottomRight) && (slots.get(bottomRight).topLeft = key)
  slots.has(bottomLeft) && (slots.get(bottomLeft).topRight = key)
}

// POSITIONS
const AGE_I = `
     2 3
    7 8 9
   d e f g
  i j k l m
 o p q r s t`

const AGE_II = `
 0 1 2 3 4 5
  6 7 8 9 a
   d e f g
    j k l
     q r`

const AGE_III = `
     2 3
    7 8 9
   d e f g
    j   l
   p q r s
    v w x
    12 13`

const fromFormatStr = str => str
  .trim()
  .split(/\s+/i)
  .map(n => slots.get(`_${(n).toString(36)}`))

const agePositions = {
  1: fromFormatStr(AGE_I),
  2: fromFormatStr(AGE_II),
  3: fromFormatStr(AGE_III),
}


// art: https://www.facebook.com/miguelcoimbraillustrator
// game: 

exportJS(function Game({ cards, slotsValues, agePositions, wonders }) {

  // GAME DATA
  Game.slots = new Map(slotsValues.map(s => [s.key, s]))
  Game.cards = cards

  // GAME STATE
  const local = Game.local = {
    buildings: [ [], [] ],
    coins: [ 7, 8 ],
    discarded: new Set,
    enemy: 1,
    player: 0,
    playerTurn: 0,
  }

  const state = Game.state = {
    // shared state (from game logic)
    deck: Eve(null),
    turn: Eve(0),
    player: Eve(0), // Eve event are synchronous
    moveCount: Eve(0),
    moves: Eve([]),
    wonders: Eve([]),

    // my state (from dom interactions)
    cursor: Stack.writer([-1,-1]),
    lastTarget: Stack.writer(200),
    interaction: Stack.writer(200),

    // enemy state (from peer connection)
    enemyCursor: Stack.writer([-1, -1]),
    enemyLastTarget: Stack.writer(200),
    enemyInteraction: Stack.writer(200),
  }

  Stack.persist({ moves: state.moves })

  state.player.on(p => local.enemy = ~(local.player = p)&1)
  state.turn.on(t => local.playerTurn = t ? local.player : local.enemy)

  // UTILS
  // we need a seeded random for deterministic plays
  let rand
  const setSeed = seed => {
    let w = (123456789 + seed) & 0xffffffff
    let z = (987654321 - seed) & 0xffffffff
    return rand = () => {
      z = (36969 * (z & 0xffff) + (z >>> 0x10)) & 0xffffffff
      w = (18000 * (w & 0xffff) + (w >>> 0x10)) & 0xffffffff
      return (((z << 0x10) + (w & 0xffff)) >>> 0) / 0x100000000
    }
  }

  // shuffle mutates the array, also need the rand to be seeded
  const shuffle = arr => {
    let i = arr.length
    let j, tmp
    while (--i > 0) {
      j = Math.floor(rand() * (i + 1))
      tmp = arr[j]
      arr[j] = arr[i]
      arr[i] = tmp
    }
    return arr
  }

  const isType = Stack.cache(t => ({ type }) => type === t)
  const moveTypes = {
    build: () => {},
    wonder: () => {},
    sell: ({ source, player }) => {
      const buildings = state.buildings.get()[player]
      const price = buildings.filter(isType['🟡']).length + 2
      local.discarded.add(source)
    }
  }

  const play = ({ type, sourceId, target }) => {
    const move = moveTypes[type]
    const turn = state.turn.get()
    const player = turn ? local.player : local.enemy
    const replay = move({ source: cards[sourceId], player, target })
    replay || state.turn.set(~turn&1) // toggle turn
  }

  Game.init = ({ seed, moves = [], isHost }) => {
    setSeed(seed)
    const firstTurn = (seed + moves.length + isHost) % 2

    // set player id
    state.player.set(Number(firstTurn === 0))

    // set player turn
    state.turn.set(firstTurn)

    // TODO: replay moves to fast-forward game state
    for (const move of moves) play(move)

    // Pick 8 wonders
    state.wonders.set(shuffle([...wonders]).slice(0, 8))

    // Pre-distribute the cards
    state.deck.set([
      // pick 20 cards from Age I
      ...shuffle(cards.filter(c => c.age === 1)).slice(0, 20),

      // pick 20 cards from Age II
      ...shuffle(cards.filter(c => c.age === 2)).slice(0, 20),

      // pick 3 Guilds and 17 cards from Age III
      ...shuffle([
        ...cards.filter(c => c.type === '🟣').slice(0, 3),
        ...cards.filter(c => c.age === 3 && c.type !== '🟣').slice(0, 17),
      ]),
    ].map((c, i) => (c.slot = agePositions[c.age][i % 20], c)))

// const isCovered = ({ bottomRight, bottomLeft } = {}) =>
//   document.getElementsByClassName(bottomRight).length +
//   document.getElementsByClassName(bottomLeft).length
// 
// const uncover = key => {
//   if (isCovered(Game.slots.get(key))) return
//   document.getElementsByClassName(key)[0]?.classList.remove('back')
// }
// 
//     isCovered(slot) || e.target.closest('.card').remove()
//     uncover(slot.topRight)
//     uncover(slot.topLeft)
//     document.getElementsByClassName('card').length || 0 // next age here

  }
}, { cards, slotsValues: [...slots.values()], agePositions, wonders })
