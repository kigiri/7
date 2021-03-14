import { randomBytes } from 'crypto'
import cookie from 'cookie'

import { exportJS } from './nostack.js'
import * as ws from './ws.js'


// AUTHENTICATE CLIENT
const getCookies = req => req.headers.cookie && cookie.parse(req.headers.cookie)
ws.onOpen(client => {
  const sessionId = getCookies(client.req)?.['X-Session-Id']
  client.id = sessionId || randomBytes(4).toString('hex')
  console.log('RTC:init', client.id)
})

// HANDLE SESSIONS SIGNALS
// initOffer -> waiting for another player
// findSession -> joining session...
// sendAnswer -> sharing connection data
// joinSession -> connection done ! starting the game
//   at this point, both clients can close the websocket connection

ws.handle('initOffer', (data, client) => {
  console.log(client.id, 'hostSession')
  client.session = data
  return { id: client.id }
})

const isHost = (client, data) => client.id === data.id
ws.handle('findSession', (data, client) => {
  console.log(client.id, 'findSession', data)
  const host = ws.find(isHost, data)
  if (!host || !host.session) throw ws.expected(Error('session not found'))
  client.host = host
  host.peer = client
  return host.session
})

ws.handle('sendAnswer', (data, client) => {
  console.log(client.id, 'joinSession', { host: client.host?.id })
  ws.send(client.host, 'joinSession', data)
  console.log('sendAnswer', data)
  return { success: true }
})



/*/ LOBBY
const timings = Array(10).fill(0)
const add = (a, b) => a + b
const avg = arr => arr.reduce(add) / arr.length
let ti = -1, averageWait, addTiming = t => ti < 10
  ? (timings[++ti] = t, averageWait = avg(timings.filter(Boolean)))
  : (addTiming = t => (timings[ti=ti+1%10] = t, averageWait = avg(timings)))(t)

const inLobby = client => client.lobby
ws.handle('joinLobby', (data, client) => {
  const match = ws.find(inLobby)
  if (!match) {
    client.lobby = Date.now()
    return { averageWait, success: 'wait-for-player' }
  }

  addTiming(Date.now() - match.lobby)
  match.lobby = false
  match.match = client
  client.match = match

  // prompt game invite
  // also signal player is removed from lobby
  ws.send(match, 'lobbyInvite')
})

ws.on('acceptInvite', (data, client) => ws.send(client.match, 'acceptInvite'))
//*/


// "stun.l.google.com:19302",
// "stun1.l.google.com:19302",
// "stun2.l.google.com:19302",
// "stun3.l.google.com:19302",
// "stun4.l.google.com:19302",
// "stun.ekiga.net",
// "stun.ideasip.com",
// "stun.rixtelecom.se",
// "stun.schlund.de",
// "stun.stunprotocol.org:3478",
// "stun.voiparound.com",
// "stun.voipbuster.com",
// "stun.voipstunt.com",
// "stun.voxgratia.org"

// CLIENT COMMUNICATION
exportJS(function RTC() {
  const sessionInput = Stack.h.input()
  const state = Stack.persist({
    sessionId: Stack.bind(sessionInput), // random str
    role: Eve(''), // host | guest
  })
 

  const createConnection = () => {
    const iceServers = [{ urls: 'stun:stun.l.google.com:19302' }]
    const conn = new RTCPeerConnection({ iceServers })
    const addCandidates = async candidates => {
      for (const candidate of candidates) {
        await conn.addIceCandidate(candidate)
      }
    }

    const waitForCandidates = new Promise((s, f) => {
      const candidates = []
      conn.onicecandidate = e => e.candidate
        ? candidates.push(e.candidate)
        : s(candidates)
    })

    RTC.conn = conn
    return { addCandidates, waitForCandidates, conn }
  }

  const host = async () => {
    console.debug('RTC.host')
    const { conn, addCandidates, waitForCandidates } = createConnection()
    state.role.set('host')
    const channel = conn.createDataChannel('state')
    channel.binaryType = 'arraybuffer'
    const channelReady = new Promise((s, f) => {
      channel.onopen = () => s({ channel })
      channel.onclose = f
    })
    const desc = await conn.createOffer()
    await conn.setLocalDescription(desc)
    const offer = { sdp: desc.sdp, candidates: await waitForCandidates }
    const { id } = await WS.initOffer(offer, 2500)
    document.cookie = `X-Session-Id=${id}; path=/; SameSite=Strict`
    state.sessionId.set(id)
    sessionInput.select()

    // waiting for guest
    const session = await WS.handle('joinSession')
    await conn.setRemoteDescription({ sdp: session.sdp, type: 'answer' })
    await addCandidates(session.candidates)
    return channelReady
  }

  const join = async (sessionId) => {
    console.debug('RTC.join', { sessionId })
    const session = await WS.findSession({ id: sessionId }, 2500)
    state.sessionId.set(sessionId)
    const { conn, addCandidates, waitForCandidates } = createConnection()
    state.role.set('guest')
    await conn.setRemoteDescription({ sdp: session.sdp, type: 'offer' })
    const desc = await conn.createAnswer()
    await conn.setLocalDescription(desc)
    await addCandidates(session.candidates)
    await WS.sendAnswer({ sdp: desc.sdp, candidates: await waitForCandidates })
    return new Promise((s, f) => {
      setTimeout(f, 2500, Error('host channel timeout'))
      conn.ondatachannel = s
    })
  }

  const coms = ({ channel }) => {
    console.log('RTC connected', { channel })

    const { input } = Encoding
    const { enemyCursor, enemyInteraction, moves, active } = Game.state
    const isHost = state.role.get() === 'host'
    Game.state.interaction.on(value => {
      input.encodeInteraction(value)
      channel.send(input.buf)
    })

    let seed
    let lastUpdate = Date.now()
    Game.state.cursor.on(([x, y]) => {
      const now = Date.now()
      // cap too ~16ms because 60hz + is overkill
      if (now - lastUpdate < 15) return
      lastUpdate = now
      input.encodeCoords(x, y)
      channel.send(input.buf)
    })

    moves.on((newMoves, oldMoves) => {
      if (!active.get()) return console.log('not sent: inactive')
      if (oldMoves?.length === newMoves.length) return console.log('not sent: same moves')
      const lastMove = newMoves[newMoves.length - 1]
      if (!lastMove) return console.log('not sent: no moves')
      const buf = Encoding.move.encode([lastMove])
      channel.send(buf)
      console.log('move sent:', lastMove, new Uint8Array(buf))
    })

    const parsePayload = buf => {
      if (buf.byteLength === input.SIZE) {
        const packet = input.decode(buf)
        enemyInteraction.set(packet.interaction)
        return enemyCursor.set(packet.cursor)
      }

      if (buf.byteLength === Encoding.seed.SIZE && !seed) {
        seed = Encoding.seed.decode(buf)
        return Game.init({ seed, isHost })
      }

      if (buf.byteLength === Encoding.pick.SIZE) {
        return encoding.pick.decode(buf)
      }
      const result = Encoding.move.decode(buf)
      console.log('decoding move', new Uint8Array(buf), '->', result)
      moves.set([...moves.get(), ...Encoding.move.decode(buf)])
    }

    channel.onmessage = ({ data }) =>
      data instanceof ArrayBuffer
        ? parsePayload(data)
        : data.arrayBuffer().then(parsePayload)

    if (!isHost) return
    seed = Math.floor(Math.random() * 0xFFFFFFFF)
    channel.send(new Uint32Array([seed]).buffer)
    Game.init({ seed, isHost })
  }

  const connect = async () => {
    const role = state.role.get()
    if (!role) return setTimeout(connect, 500)
    try {
      coms(await (role === 'host' ? host() : join(state.sessionId.get())))
    } catch (err) {
      console.error(err)
      setTimeout(connect, 2000)
    } 
  }

  WS.connection.then(connect)
})