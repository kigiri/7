import { exportJS } from './nostack.js'

// GAME DATA
// helper functions to make the card declaration less tedious for now
// could be generated in a big JSON and deleted
const arr10 = [...Array(10).keys()]
const N = n => arr10.slice(0, n)
const point = amount => ({ effects: [ { type: '๐', amount } ] })
const military = amount => ({ effects: [...Array(amount).keys()].map(() => ({ type: 'โ' })) })
const toFX = r => /[0-9]/.test(String(r))
  ? { type: '๐ต', amount: Number(r) }
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
    .map(r => r.type === '๐ต' ? { ...r, type: '๐' } : r)
})

let MAX_CARD = 0
const card = age => (type, name, ...props) =>
  ({ age, name, type, ...Object.assign({}, ...props), index: MAX_CARD++ })

const I = card(1)
const II = card(2)
const III = card(3)

const cards = [
  I('๐ค', 'Lumber Yard', resource('๐ฒ')),
  I('๐ค', 'Logging Camp', resource('๐ฒ'), cost(1)),
  I('๐ค', 'Clay Pool', resource('๐งฑ')),
  I('๐ค', 'Clay Pit', resource('๐งฑ'), cost(1)),
  I('๐ค', 'Quarry', resource('โฐ')),
  I('๐ค', 'Stone Pit', resource('โฐ'), cost(1)),
  I('โช', 'Loom', resource('๐งต'), cost(1)),
  I('โช', 'Press', resource('๐'), cost(1)),
  I('๐ต', 'Theater', point(3)),
  I('๐ต', 'Altar', point(3)),
  I('๐ต', 'Baths', point(3), cost('โฐ')),
  I('๐ด', 'Guard Tower', military(1)),
  I('๐ด', 'Stable', military(1), cost('๐ฒ')),
  I('๐ด', 'Garrison', military(1), cost('๐งฑ')),
  I('๐ด', 'Palisade', military(1), cost(2)),
  I('๐ข', 'Workshop', science('๐'), cost('๐')),
  I('๐ข', 'Apothecary', science('โ'), cost('๐งต')),
  I('๐ข', 'Scriptorium', science('โ'), cost(2)),
  I('๐ข', 'Pharmacist', science('โ'), cost(2)),
  I('๐ก', 'Stone Reserve', discount('โฐ'), cost(3)),
  I('๐ก', 'Clay Reserve', discount('๐งฑ'), cost(3)),
  I('๐ก', 'Wood Reserve', discount('๐ฒ'), cost(3)),
  I('๐ก', 'Tavern', resource(4)),

  II('๐ค', 'Sawmill', resource('๐ฒ๐ฒ'), cost(2)),
  II('๐ค', 'Brickyard', resource('๐งฑ๐งฑ'), cost(2)),
  II('๐ค', 'Shelf Quarry', resource('โฐโฐ'), cost(2)),
  II('โช', 'Dyehouse', resource('๐งต')),
  II('โช', 'Drying Room', resource('๐')),
  II('๐ต', 'Tribunal', point(5), cost('๐ฒ๐ฒ๐งต')),
  II('๐ต', 'Statue', point(4), cost('๐งฑ๐งฑ')),
  II('๐ต', 'Temple', point(4), cost('๐ฒ๐')),
  II('๐ต', 'Aqueduct', point(5), cost('โฐโฐโฐ')),
  II('๐ต', 'Rostrum', point(4), cost('โฐ๐ฒ')),
  II('๐ด', 'Walls', military(2), cost('โฐโฐ')),
  II('๐ด', 'Horse Breeders', military(1), cost('๐งฑ๐ฒ')),
  II('๐ด', 'Barracks', military(1), cost(3)),
  II('๐ด', 'Archery Range', military(2), cost('โฐ๐ฒ๐')),
  II('๐ด', 'Parade Ground', military(2), cost('๐งฑ๐งฑ๐งต')),
  II('๐ข', 'Library', science('โ2'), cost('โฐ๐ฒ๐งต')),
  II('๐ข', 'Dispensary', science('โ2'), cost('๐งฑ๐งฑโฐ')),
  II('๐ข', 'School', science('โ1'), cost('๐ฒ๐๐')),
  II('๐ข', 'Laboratory', science('๐1'), cost('๐ฒ๐งต๐งต')),
  II('๐ก', 'Forum', resource('๐งต๐'), cost('3๐งฑ')),
  II('๐ก', 'Caravansery', resource('๐ฒ๐งฑโฐ'), cost('2๐งต๐')),
  II('๐ก', 'Customs House', discount('๐งต๐'), cost(4)),
  II('๐ก', 'Brewery', resource(6)),

  III('๐ต', 'Palace', point(7), cost('๐งฑโฐ๐ฒ๐งต๐งต')),
  III('๐ต', 'Town hall', point(7), cost('โฐโฐโฐ๐ฒ๐ฒ')),
  III('๐ต', 'Obelisk', point(5), cost('โฐโฐ๐งต')),
  III('๐ต', 'Gardens', point(6), cost('๐งฑ๐งฑ๐ฒ๐ฒ')),
  III('๐ต', 'Pantheon', point(6), cost('๐งฑ๐ฒ๐๐')),
  III('๐ต', 'Senate', point(5), cost('๐งฑ๐งฑโฐ๐')),
  III('๐ด', 'Arsenal', military(3), cost('๐งฑ๐งฑ๐งฑ๐ฒ๐ฒ')),
  III('๐ด', 'Pretorium', military(3), cost(8)),
  III('๐ด', 'Fortifications', military(2), cost('โฐโฐ๐งฑ๐')),
  III('๐ด', 'Siege Workshop', military(2), cost('๐ฒ๐ฒ๐ฒ๐งต')),
  III('๐ด', 'Circus', military(2), cost('๐งฑ๐งฑโฐโฐ')),
  III('๐ข', 'Academy', science('๐3'), cost('โฐ๐ฒ๐งต๐งต')),
  III('๐ข', 'Study', science('๐3'), cost('๐ฒ๐ฒ๐งต๐')),
  III('๐ข', 'University', science('๐ญ2'), cost('๐งฑ๐งต๐')),
  III('๐ข', 'Observatory', science('๐ญ2'), cost('โฐ๐๐')),
  III('๐ก', 'Chamber of Commerce', resource(1)),
  III('๐ก', 'Port', resource(1)),
  III('๐ก', 'Armory', resource(1)),
  III('๐ก', 'Lighthouse', resource(1)),
  III('๐ก', 'Arena', resource(1)),

// III('๐ฃ', 'arena', resource(1)),
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
    coins: [ -1, -1 ],
    discarded: new Set,
    enemy: -1,
    player: -1,
  }

  const state = Game.state = {
    // shared state (from game logic)
    deck: Eve(null),
    turn: Eve(-1), // Id of the player current turn
    active: Eve(-1), // Id of the active player
    player: Eve(-1), // Eve event are synchronous
    moves: Eve([]), // all moves of the game
    wonders: Eve([]),

    // my state (from dom interactions)
    cursor: Stack.writer([-1,-1]),
    lastTarget: Stack.writer(0xFF),
    interaction: Stack.writer(0xFF),
    move: Eve(null),

    // enemy state (from peer connection)
    enemyMove: Eve(null),
    enemyCursor: Stack.writer([-1, -1]),
    enemyLastTarget: Stack.writer(0xFF),
    enemyInteraction: Stack.writer(0xFF),
  }

  // Stack.persist({ moves: state.moves })

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
      const buildings = local.buildings[player]
      const price = buildings.filter(isType['๐ก']).length + 2
      local.discarded.add(source)
    }
  }

  const play = ({ type, source, target }) => {
    const move = moveTypes[type]
    const turn = state.turn.get()
    const replay = move({
      player: turn,
      source: cards[source],
      target: cards[target],
    })
    if (replay) return
    state.active.set(Number(turn ==! local.player))
    state.moves.set([...state.moves.get(), { type, source, target }])
    state.turn.set(~turn&1)
  }

  Game.attemptPlay = move => {
    try {
      play(move)
      state.move.set(move)
    }
    catch (err) {
      console.log(err)
      // check if we need a target
      // check if we don't have the ressources
    }
  }

  state.enemyMove.on(move => {
    move && play(move)
  })

  Game.init = ({ seed, isHost }) => {
    setSeed(seed)
    const moves = state.moves.get()
    const firstTurn = (seed + moves.length) % 2
    const player = isHost ? firstTurn : ~firstTurn&1

    // set player data
    local.player = player
    local.enemy = ~player&1
    state.player.set(player)
    state.turn.set(firstTurn)
    state.active.set(Number(player === firstTurn))

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
        ...cards.filter(c => c.type === '๐ฃ').slice(0, 3),
        ...cards.filter(c => c.age === 3 && c.type !== '๐ฃ').slice(0, 17),
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
