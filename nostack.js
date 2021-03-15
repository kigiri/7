import { fork } from 'child_process'
import { networkInterfaces } from 'os'
import { fileURLToPath } from 'url'
import { stat, readdir, readFile } from 'fs/promises'
import { dirname, join, basename, parse } from 'path'
import http from 'http'
import https from 'https'
import { createReadStream, readFileSync, appendFile } from 'fs'
import { performance } from 'perf_hooks'

const { fromEntries } = Object


/*
** Utils
*/

export const getLatestChangeMS = async path => {
  const stats = await stat(path)
  return Math.max(stats.mtimeMs, stats.ctimeMs, stats.birthtimeMs)
}

export const listFiles = check => async path => {
  const files = await readdir(path, { withFileTypes: true })
  const nested = await Promise.all(
    files.map(f => {
      if (f.isDirectory()) {
        if (f.name === 'node_modules') return []
        return listJSFiles(join(path, f.name))
      }
      return f.isFile() && check(f.name) ? join(path, f.name) : []
    }),
  )

  return nested.flat()
}

export const listJSFiles = listFiles(f => f.endsWith('.js'))
export const listCSSFiles = listFiles(f => f.endsWith('.css'))
export const getRootDir = meta => dirname(fileURLToPath(meta.url))
export const errors = new Proxy(
  {},
  {
    get: (src, code) => {
      if (src[code]) return src[code]
      const status = Number(code.slice(1))
      return (src[code] = err => ((err.statusCode = status), err))
    },
  },
)



/*
** Watcher
*/

const rootDir = getRootDir(import.meta)
const POLLING_RATE = Number(process.env.POLLING_RATE) || 250

const getFileTiming = async file => [file, await getLatestChangeMS(file)]
const getTimingsMap = async files =>
  new Map(await Promise.all(files.map(getFileTiming)))

let _fork
const start = async () => {
  console.log(_fork ? 'watcher-restarting' : 'watcher-starting')
  setTimeout(poll, POLLING_RATE)
  _fork?.kill()
  _fork = fork(fileURLToPath(new URL('./index.js', import.meta.url)))
}

let history = await getTimingsMap(await listJSFiles(rootDir))
const poll = async () => {
  const timings = await getTimingsMap(await listJSFiles(rootDir))
  const changes = []
  for (const [filePath, time] of timings) {
    const previousTime = history.get(filePath)
    if (previousTime === time) continue
    changes.push(`edited: ${filePath.slice(rootDir.length - 3)}`)
  }
  for (const [filePath] of history) {
    if (timings.get(filePath)) continue 
    changes.push(`deleted: ${filePath.slice(rootDir.length - 3)}`)
  }
  if (!changes.length) return setTimeout(poll, POLLING_RATE)
  console.log('watcher-changes', changes)
  history = timings
  start()
}


process.argv[1].endsWith('nostack.js') && start()


/*
** Persistance
*/

const stringify = value => `${JSON.stringify(value)}\n`
const defered = (r = {}) => (r.promise = new Promise((s, f) => (r.reject = f, r.resolve = s)), r)
export const persist = (meta, { primary = 'id' } = {}) => {
  const { name } = parse(meta.url)
  const file = `${name}.json`
  const table = new Map
  try {
    const lines = readFileSync(file, 'utf8').split('\n')
    for (const raw of lines) {
      if (!raw) continue
      const value = JSON.parse(raw)
      typeof value === 'object'
        ? table.set(value[primary], value)
        : table.remove(value)
    }
  } catch (err) {
    if (err.code !== 'ENOENT') throw err
  }
  let pending = defered()
  pending.writes = []
  setInterval(() => {
    if (!pending.writes.length) return
    appendFile(file, pending.writes.map(stringify).join(''), err => {
      err ? pending.reject(err) : pending.resolve(pending.writes.length)
      pending = defered()
      pending.writes = []
    })
  }, 250)
  const writer = value => {
    pending.writes.push(value)
    return pending.promise
  }

  table.wset = (k, v) => {
    if (v == null) {
      v = k
      k = v[primary]
    }
    table.set(k, v)
    return writer(v)
  }

  table.wremove = k => {
    if (k == null) return
    k = k[primary] || k
    table.remove(k)
    return writer(k)
  }

  return table
}



/*
** HTTP-Server
*/

export const indexJS = []
export const indexCSS = []
export const indexHTML = []
const files = await listJSFiles(rootDir)
export const handlers = {}
await Promise.all(files.filter(f => f.endsWith('.browser.js')).map(async f => {
  handlers[`/${basename(f).slice(0, -11)}.js`] = await readFile(f, 'utf8')
}))

const jsFiles = Object.keys(handlers)

export const serve = (meta, handler) =>
  handlers[`/${parse(fileURLToPath(meta.url)).name}`] = handler

const parseUrlFormEncoded = form => fromEntries(new URLSearchParams(form))
const params = req => fromEntries(new URL(`http://s${req.url}`).searchParams)
const text = async req => {
  req.setEncoding('utf8')
  let body = ''
  for await (const chunk of req) body += chunk
  return body
}

const parsers = {
  'text/html': text,
  'application/json': async req => JSON.parse(await text(req)),
  'application/x-www-form-urlencoded': async req =>
    parseUrlFormEncoded(await text(req)),
}

const createServer = !process.env.TLS_KEY_PATH ? http.createServer :
  fn => https.createServer({
    key: readFileSync(`${process.env.TLS_KEY_PATH}-key.pem`),
    cert: readFileSync(`${process.env.TLS_KEY_PATH}-cert.pem`),
  }, fn)

export const server = createServer(async (req, res) => {
  let _err, start = performance.now()
  const url = new URL(req.url, `http://${req.headers.host}`)
  try {
    const handler = handlers[url.pathname]
    url.pathname.endsWith('.js') && res.setHeader('Content-Type', 'text/javascript')
    if (typeof handler === "string") return res.end(handler)
    if (!handler) {
      const file = createReadStream(url.pathname)
      file.on('error', err => {
        if (err.code !== 'ENOENT') {
          res.statusCode = 500
          res.end(err.stack)
        } else {
          res.statusCode = 404
          res.end(`${url.pathname} not found`)
        }
      })
      return file.on('open', () => file.pipe(res))
    }
    const parser = parsers[req.headers['content-type']]
    const params = parser ? await parser(req) : fromEntries(url.searchParams)
    const data = await handler({ params, req, res, url })
    res.writableEnded || // TODO: handle buffer data type here too
      res.end(typeof data === 'string' ? data : JSON.stringify(data))
  } catch (err) {
    _err = err
    if (!res.writableEnded) {
      res.statusCode = err.statusCode || err.code === 'ENOENT' ? 404 : 500
      res.end(JSON.stringify({ error: err.message }))
    }
  } finally {
    const meta = _err || {}
    meta.elapsed = Math.round((performance.now() - start) * 1000) / 1000
    console[_err ? 'error' : 'debug'](req.method, url.pathname, meta)
  }
})

server.on('listening', () => {
  handlers['/'] = buildIndex()
  const details = server.address()

  if (typeof details === 'string') return console.log(details)
  const local = details?.address === '::' ? 'localhost' : details?.address
  Object.entries(networkInterfaces())
    .map(([name, interfaces]) => interfaces.map(i => [name, i]))
    .flat()
    .filter(([,i]) => i.family === 'IPv4' && !i.internal)
    .map(([name, i]) => `${name}: http://${i.address}:${details?.port}`)
    .forEach(n => console.log(n))
})

const modulesInit = []
const modulesDeclarations = []
export const exportJS = (fn, rawArgs) => {
  const args = rawArgs == null ? '' : `JSON.parse(\`${JSON.stringify(rawArgs)}\`)`
  if (fn.name) {
    modulesDeclarations.push(String(fn))
    modulesInit.push(`${fn.name}(${args})`)
  } else {
    modulesInit.push(fn)
  }
}

const buildIndex = () => `
<!DOCTYPE html>
<html>
<head>
  <title>${process.env.TITLE||'No Stack'}</title>
  <meta charset="utf-8">
  <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>${process.env.FAV||'👏'}</text></svg>">
  <style>${indexCSS.join('\n')}</style>
</head>
<body>
${indexHTML.join('\n')}
<script type="module">
${modulesDeclarations.join('\n')}

${modulesInit.join('\n')}

${indexJS.join('\n')}
</script>
</body>
</html>
`

// FRONT-END "framework"
export function Eve() {
  const isFn = fn => arg => {
    if (typeof arg === 'function') return fn(arg)
    throw Error(`${typeof arg} is not a function`)
  }
  const call = subs => value => { for (const fn of subs) fn(value) }
  return (Eve = (data, opts) => {
    const subs = new Set()
    const on = isFn(fn => (subs.add(fn), () => subs.delete(fn)))
    const next = () => new Promise(once)
    const once = isFn(fn => subs.add(function $(prev, next) {
      fn(prev, next)
      subs.delete($)
    }))
    if (data === undefined) return { next, once, on, trigger: call(subs) }
    return {
      once,
      next,
      get: () => data,
      on: isFn(fn => (fn(data), on(fn))),
      set: (next, force) => {
        if (force || next === data) return
        const prev = data
              data = next
        for (const fn of subs) fn(next, prev)
      },
    }
  })()
}

exportJS(Eve)
exportJS(function Stack() {
  const { trigger: readNow, ...read } = Eve()
  const { trigger: writeNow, ...write } = Eve()
  requestAnimationFrame(function loop() {
    readNow()
    writeNow()
    requestAnimationFrame(loop)
  })

  const isObject = value => value?.constructor === Object
  const append = (node, children) => {
    if (children == null) return node
    if (!Array.isArray(children)) return (node.append(children), node)
    for (const child of children) append(node, child)
    return node
  }

  const empty = node => {
    while (node && node.firstChild) node.removeChild(node.firstChild)
    return node
  }

  const throttle = (fn, delay, t, call = () => (t = 0, fn())) =>
    () => t || (t = setTimeout(call, delay))
  
  const nodeGetters = n => {
    switch (n.type) {
      case 'number':
      case 'range': return () => Number(n.value)
      case 'radio':
      case 'checkbox': return () => n.checked
      default: return () => n.value
    }
  }

  const nodeSetters = n => {
    const k = (n.type === 'radio' || n.type === 'checkbox') ? 'checked' : 'value'
    return v => n[k] = v
  }

  Stack.bind = node => {
    const get = nodeGetters(node)
    const { set, ...obs } = Eve(get())
    read.on(() => set(get()))
    obs.set = nodeSetters(node)
    return obs
  }

  Stack.persist = all => {
    for (const [k, { set, get, on }] of Object.entries(all)) {
      const cached = localStorage[k]
      const save = () => localStorage[k] = JSON.stringify(get())
      try { cached ? set(JSON.parse(cached)) : save() }
      catch (err) { save() }
      on(throttle(save, 250))
    }
    return all
  }

  Stack.on = (all, fn) => {
    const cache = {}
    const trigger = throttle(() => fn(cache), 0)
    for (const [k, { get, on }] of Object.entries(all)) {
      on(v => trigger(cache[k] = v))
    }
  }

  // Get value only once per reads (always before writes)
  Stack.reader = get => {
    const { set, ...obs } = Eve(get()||null)
    obs.remove = read.on(() => set(get()))
    return obs
  }

  // event only triggered once per writes
  Stack.writer = value => {
    const { set, ...obs } = Eve(value)
    obs.set = next => value = next
    obs.remove = write.on(() => set(value))
    return obs
  }

  Stack.replace = (node, content) => append(empty(node), content)
  Stack.setText = (node, text) => node.firstChild.nodeValue = text
  Stack.css = code => document.head.append(Stack.h.style(code))
  const cache = fn => new Proxy({}, { get: (c, k) => c[k] || (c[k] = fn(k)) })
  Stack.h = cache(tag => (a, b) => {
    // TODO: handle namespace for SVG
    const node = document.createElement(tag)
    if (a == null) return node
    if (!isObject(a)) return append(node, a)
    for (const key of Object.keys(a)) {
      const value = a[key]
      if (value == null) continue
      isObject(value) ? Object.assign(node[key], value) : (node[key] = value)
    }
    return append(node, b)
  })

  Object.assign(Stack, { isObject, append, empty, throttle, cache, read, write })
})

// CSS RESET
indexCSS.push(`
/* Box sizing rules */
*,
*::before,
*::after {
  box-sizing: border-box;
}

/* Remove default padding */
ul[class],
ol[class] {
  padding: 0;
}

/* Remove default margin */
body,
h1,
h2,
h3,
h4,
p,
ul[class],
ol[class],
li,
figure,
figcaption,
blockquote,
dl,
dd {
  margin: 0;
}

/* Set core body defaults */
body {
  min-height: 100vh;
  scroll-behavior: smooth;
  text-rendering: optimizeSpeed;
  line-height: 1.5;
}

/* Remove list styles on ul, ol elements with a class attribute */
ul[class],
ol[class] {
  list-style: none;
}

/* A elements that don't have a class get default styles */
a:not([class]) {
  text-decoration-skip-ink: auto;
}

/* Make images easier to work with */
img {
  max-width: 100%;
  display: block;
}

/* Natural flow and rhythm in articles by default */
article > * + * {
  margin-top: 1em;
}

/* Inherit fonts for inputs and buttons */
input,
button,
textarea,
select {
  font: inherit;
}

/* Remove all animations and transitions for people that prefer not to see them 
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}*/
`)