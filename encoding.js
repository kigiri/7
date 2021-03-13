import { exportJS } from './nostack.js'


// 4 types of packets
// - seed (game initialisation)
// - pick (wonder selection phase)
// - input (user mouse interaction)
// - move (game move)

// Note that I use the size of the buffer
// and context of the game to infer info
// as such, move can be padded to not collide

// BUFFER PAYLOAD LAYOUT
let offset = 0
const move = { MIN: 2, type: {} }
const seed = { SIZE: 1 }
const pick = { SIZE: 1 }
const input = { X: 0, Y: 4, INTERACTION: 8, SIZE: 9 }
move.type = {
    sell: 200, 200: 'sell',
   build: 201, 201: 'build',
  wonder: 202, 202: 'wonder',
}

exportJS(function Encoding(defs) {
  const _8 = Game.state.wonders.get()
  const INPUT_SIZE = defs.input.SIZE

  // SEED  UInt32
  defs.seed.decode = buf => new DataView(buf).getUint32(0)

  // PICK 1 (Uint8 bitmask)
  defs.pick.decode = buf => {
    const pick = new DataView(buf).getUint8(0)
    return Game.state.wonders.get().filter((_, i) => pick & (1 << i))
  }
  // MOVE PACKET
  const moveTypes = defs.move.type
  const encodeMove = ({ source, target, type }) => target
    ? [ moveTypes[type], source.index, target.index ]
    : [ moveTypes[type], source.index ]

  defs.move.encode = moves => {
    const data = moves.flatMap(encodeMove)
    // we pad to avoid collision with the input
    data.length === INPUT_SIZE && data.push(0xff)
    return new Uint8Array(data).buffer
  }

  defs.move.decode = buf => {
    const moves = []
    let move
    for (const byte of new Uint8Array(buf)) {
      if (byte > 202) continue // skip padding
      if (byte < 100) {
        move.source = Game.cards[byte]
      } else if (byte < 200) {
        move.target = Game.cards[byte-100]
      } else {
        move && moves.push(move)
        move = { type: moveTypes[byte] }
      }
    }
    return moves
  }

  const { X, Y, INTERACTION } = defs.input
  const inputBuf = defs.input.buf = new ArrayBuffer(defs.input.SIZE)
  const inputView = new DataView(inputBuf)
  defs.input.encodeInteraction = i => inputView.setUint8(INTERACTION, i)
  defs.input.encodeCoords = (x, y) => {
    inputView.setFloat32(X, x)
    inputView.setFloat32(Y, y)
  }
  defs.input.decode = buf => {
    const view = new DataView(buf)
    return {
      interaction: view.setUint8(INTERACTION),
      cursor: [view.setFloat32(X), view.setFloat32(Y)],
    }
  }

  Object.assign(Encoding, defs)
}, { input, move, seed, pick })