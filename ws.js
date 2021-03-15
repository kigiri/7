import _ws from 'ws'

import { Eve, server, exportJS } from './nostack.js'

const clients = new Set()
const makePayload = (route, data) =>
  data == null ? route : `${route}:${JSON.stringify(data)}`

export const broadcast = (type, data, condition = () => true) => {
  const payload = JSON.stringify({ type, data })
  let count = 0
  for (const client of clients) {
    if (!condition(client, data)) continue
    client.ws.send(payload)
    count++
  }
  count && console.log('broadcast', { type, data })
  return count
}

// handle means that we will reply with the return value
// on just trigger call the function
export const events = {}
export const handle = (key, fn) => {
  events[key] = fn
  exportJS(`WS.${key} = (handle => (d, t) => handle('${key}', d, t))(WS.handle)`)
}

export const on = key => {
  if (events[key]) return events[key].on
  exportJS(`WS.${key} = (send => data => send('${key}', data))(WS.send)`)
  return (events[key] = Eve()).on
}

export const find = (fn, data) => {
  for (const client of clients) {
    if (fn(client, data)) return client
  }
}

const EXPECTED = Symbol('EXPECTED')
export const expected = err => (err[EXPECTED] = true, err)
export const send = (client, type, data) =>
  client.ws.send(JSON.stringify({ type, data }))

const socketEvents = { open: Eve() }
export const onOpen = socketEvents.open.on
new _ws.Server({ server }).on('connection', (ws, req) => {
  const client = { ws, req }
  clients.add(client)
  socketEvents.open.trigger(client)
  ws.on('close', () => clients.delete(client))
  ws.on('message', message => {
    const { type, data } = JSON.parse(message)
    const handler = events[type]
    if (!handler) return console.log('not found', { type, data })
    if (handler.trigger) {
      console.log('WS:on', type, data)
      return handler.trigger({ data, client })
    }
    try {
      const result = handler(data, client)
      result && ws.send(JSON.stringify({ type, data: result }))
      console.log('WS:event', { type, data, result })
    } catch (err) {
      send(client, `${type}Error`, { message: err.message })
      err[EXPECTED]
        ? console.log('WS:error', { type, data })
        : console.error('WS:error', { type, data }, `\n${err.stack}`)
    }
  })
})

// CLIENT MODULE
exportJS(function WS() {
  const routes = {}
  const handle = WS.handle = async (key, data, timeout) => {
    if (typeof data === 'function') return (routes[key] = data)
    try {
      if (typeof routes[key] === 'function') {
        throw Error(`${key} already registered as an event`)
      }
      await routes[key]
      return await new Promise((s, f) => {
        timeout && setTimeout(f, timeout, Error(`${key} timeout`))
        routes[`${key}Error`] = f
        routes[key] = s
        data && send(key, data)
      })
    } finally {
      routes[key] = undefined
      routes[`${key}Error`] = undefined
    }
  }

  const { protocol, host } = location
  const socket = new WebSocket(`ws${protocol.slice(4)}//${host}`)
  WS.connection = new Promise((s, f) => {
    socket.onopen = s
    socket.onerror = f // TODO: handle connexion error
  })

  const send = WS.send = (type, data) =>
  console.debug('WS.send', { type, data }) ||
    socket.send(JSON.stringify({ type, data }))

  socket.onmessage = event => {
    const { type, data } = JSON.parse(event.data)
    const route = routes[type]
    if (!route) return console.warn('WS.receive', { type }, 'not found')
    console.debug('WS.receive', { type, data })
    route(data)
  }

  socket.onclose = async function reconnectAndReload(e) {
    setTimeout(() => {
      const s = new WebSocket(`ws://${location.host}`)
      s.onopen = () => location.reload()
      s.onclose = s.onerror = reconnectAndReload
    }, 1000)
  }
})
