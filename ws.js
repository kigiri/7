import _ws from 'ws'

import { event, server, exportJS } from './nostack.js'

const clients = new Set()
const makePayload = (route, data) =>
  data == null ? route : `${route}:${JSON.stringify(data)}`

export const broadcast = (route, data, condition = () => true) => {
  const payload = makePayload(route, data)
  let count = 0
  for (const client of clients) {
    if (!condition(client, data)) continue
    client.ws.send(payload)
    count++
  }
  count && console.log('broadcast', { type: route, data })
  return count
}

const socketEvents = { connection: event(), close: event(), message: event() }
export const onConnection = socketEvents.connection.on
export const onMessage = socketEvents.message.on
export const onClose = socketEvents.close.on

// handle means that we will reply with the return value
// on just trigger call the function
export const events = {}
export const handle = (key, fn) => {
  events[key] = fn
  exportJS(`WS.${key} = (handle => (d, t) => handle('${key}', d, t))(WS.handle)`)
}

export const on = key => {
  if (events[key]) throw Error(`event ${key} already registered`)
  const trigger = event()
  exportJS(`WS.${key} = (send => data => send('${key}', data))(WS.send)`)
  return (events[key] = trigger).on
}


export const find = (fn, data) => {
  for (const client of clients) {
    if (fn(client, data)) return client
  }
}

const EXPECTED = Symbol('EXPECTED')
export const expected = err => (err[EXPECTED] = true, err)
export const send = (client, route, data) =>
  client.ws.send(makePayload(route, data))

new _ws.Server({ server }).on('connection', (ws, req) => {
  const client = { ws, req }
  clients.add(client)
  socketEvents.connection(client)
  ws.on('close', () => {
    clients.delete(client)
    onClose(client)
  })
  ws.on('message', message => {
    const delimIndex = message.indexOf(':')
    const type = message.slice(0, delimIndex)
    const data = JSON.parse(message.slice(delimIndex + 1))
    // handle user input
    const handler = events[type]
    if (!handler) return console.log('not found', { type, data })
    if (handler.on) {
      console.log('WS:on', type, data)
      return handler({ data, client })
    }
    try {
      const result = handler(data, client)
      result && ws.send(makePayload(type, result))
      console.log('WS:event', { type, data, result })
    } catch (err) {
      ws.send(makePayload(`${type}Error`, { message: err.message }))
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

  const socket = new WebSocket('ws://localhost:8080')
  WS.connection = new Promise((s, f) => {
    socket.onopen = s
    socket.onerror = f // TODO: handle connexion error
  })

  const send = WS.send = (type, data) =>
  console.debug('WS.send', { type, data }) ||
  (data == null
    ? socket.send(type)
    : socket.send(`${type}:${JSON.stringify(data)}`))

  socket.onmessage = event => {
    const message = event.data
    const delimIndex = message.indexOf(':')
    const type = delimIndex < 0 ? message : message.slice(0, delimIndex)
    const route = routes[type]
    if (!route) return console.warn('WS.receive', { type }, 'not found')
    const data = delimIndex > 0 ? JSON.parse(message.slice(delimIndex + 1)) : {}
    console.debug('WS.receive', { type, data })
    route(data)
  }

  socket.onclose = async function reconnectAndReload(e) {
    setTimeout(() => {
      const s = new WebSocket('ws://localhost:8080')
      s.onopen = () => location.reload()
      s.onclose = s.onerror = reconnectAndReload
    }, 1000)
  }
})
