import { fork } from 'child_process'
import { networkInterfaces } from 'os'
import { fileURLToPath } from 'url'
import { stat, readdir, readFile } from 'fs/promises'
import { dirname, join, basename, parse } from 'path'
import { createServer } from 'http'
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
export function Eve() {
  const id = _ => _
  const eq = (a, b) => a === b
  const call = subs => value => { for (const fn of subs) fn(value) }
  return (Eve = (data, opts) => {
    const subs = new Set()
    const on = fn => (subs.add(fn), () => subs.delete(fn))
    const next = () => new Promise(once)
    const once = fn => subs.add(function $(prev, next) {
      fn(prev, next)
      subs.delete($)
    })
    if (data === undefined) return { next, once, on, trigger: call(subs) }
    const { mapper = id, compare = eq } = opts || {}
    data = mapper(data)
    return {
      once,
      next,
      map: mapper => Eve(data, { mapper }),
      get: () => data,
      on: fn => (fn(data), on(data)),
      set: (next, force) => {
        next = mapper(next)
        if (force || next === data) return
        for (const fn of subs) fn(next, data)
        data = next
      },
    }
  })()
}

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
exportJS(function Stack() {
  const VALUE = Symbol('value')
  const writers = new Set()
  const readers = new Set()
  const loop = () => {
    for (const reader of readers) {
      try { reader() } catch (err) {
        err.reader = reader
        console.error(err)
      }
    }

    for (const write of writers) write()
    requestAnimationFrame(loop)
  }
  requestAnimationFrame(loop)

  const isObject = value => value?.constructor === Object
  const toId = key =>
    /^[$A-Za-z_][0-9A-Za-z_$]*$/.test(key) ? `.${key}` : `[${JSON.stringify(key)}]`

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

  const initState = state => {
    const build = (value, path) => {
      if (isObject(value)) {
        return Object.fromEntries(Object.entries(value)
          .map(([ k, v ]) => [ k, build(v, `${path}${toId(k)}`) ]))
      }

      const set = new Function(['s', 'v'], `return s${path}=v`)
      const v = { [VALUE]: path, get: () => value }

      if (value instanceof Node) {
        v.set = nodeSetters(value)
        value = nodeGetters(value)
      }

      let refresh
      if (typeof value === 'function') {
        const reader = value
        value = reader()
        readers.add(() => {
          const next = reader()
          if (next === value) return
          set(state, value = next)
          refresh = true
        })
      } else {
        v.set = newValue => set(state, newValue)
        const reader = new Function(['s'], `return s${path}`)
        readers.add(() => {
          const next = reader(state)
          if (next === value) return
          value = next
          refresh = true
        })
      }

      const subs = new Set()
      v.sub = sub => {
        sub(value)
        subs.size || writers.add(update)
        subs.add(sub)
        return () => {
          subs.delete(sub)
          subs.size || writers.delete(update)
        }
      }

      const update = () => {
        if (!refresh) return
        for (const sub of subs) {
          try {
            sub(value)
          } catch (err) {
            err.path = path
            err.value = value
            err.subscriber = sub
            console.error(err)
          }
        }
        refresh = false
      }

      v.map = fn => {
        const vv = Object.create(v)
        vv.sub = s => v.sub(x => s(fn(x, state)))
        return vv
      }
      return v
    }
    return build(state, '')
  }

  const append = (elem, value) => {
    if (value == undefined) return elem
    switch (typeof value) {
      case 'string':
      case 'number':
      case 'function':
      case 'boolean': {
        elem.appendChild(document.createTextNode(value))
        return elem
      }
      case 'symbol': return append(elem, `Symbol(${value.description})`)
      case 'object': {
        if (value[VALUE] !== undefined) {
          const node = document.createTextNode('')
          let unsub
          const reader = () => {
            if (document.body.contains(elem)) {
              unsub || (unsub = value.sub(v => node.nodeValue = v))
            } else if (unsub) {
              unsub()
              unsub = undefined
              readers.delete(reader)
            }
          }
          readers.add(reader)
          // TODO: remove when the element is dismounted.
          elem.appendChild(node)
        } else if (value instanceof Node) {
          elem.appendChild(value)
        } else if (Array.isArray(value)) {
          for (const v of value) append(elem, v)
        }
        return elem
      }
      console.warn('Unexpected children value type', value, elem)
      return elem
    }
  }

  const mergeValue = (src, key, value) => (value && value[VALUE] !== undefined)
    ? value.sub(v => src[key] = v)
    : src[key] = value

  const createElement = tag => (a, b) => {
    // TODO: handle namespace for SVG
    const elem = document.createElement(tag)
    if (a == null) return elem
    if (!isObject(a) || a[VALUE] !== undefined) return append(elem, a)
    for (const key of Object.keys(a)) {
      const value = a[key]
      if (value == null) continue
      if (isObject(value) && value[VALUE] === undefined) {
        for (const k of Object.keys(value)) {
          mergeValue(elem[key], k, value[k])
        }
      }
      mergeValue(elem, key, value)
    }
    return append(elem, b)
  }

  const h = new Proxy({}, {
    get: (s, tag) => s[tag] || (s[tag] = createElement(tag))
  })

  const watch = object => Object.fromEntries(Object.keys(object)
    .filter(k => typeof object[k] !== 'function')
    .map(k => [ k, isObject(object[k]) ? watch(object[k]) : () => object[k]]))

  const empty = elem => {
    while (elem && elem.firstChild) elem.removeChild(elem.firstChild)
    return elem
  }

  const save = (k, v) => localStorage[k] = JSON.stringify(v)
  const persist = (value, prefix = '@@') => {
    const key = `${prefix}${value[VALUE]}`
    const cached = localStorage[key]
    if (cached) {
      try { value.set && value.set(JSON.parse(cached)) }
      catch (err) { localStorage[key] = JSON.stringify(value.get()) }
    } else {
      localStorage[key] = JSON.stringify(value.get())
    }

    let t
    return value.sub(v => {
      clearTimeout(t)
      t = setTimeout(save, 200, key, v)
    })
  }

  const replace = (elem, content) => append(empty(elem), content)
  const setText = (elem, text) => elem.firstChild.nodeValue = text
  const css = code => document.head.append(h.style(code))
  const sub = (values, fn) => {
    if (values == null) return
    const cache = {}
    for (const [k, s] of Object.entries(values)) {
      cache[k] = s.get()
      s.sub(v => {
        cache[k] = v
        fn(cache)
      })
    }
  }

  Object.assign(Stack, {
    writers,
    readers,
    isObject,
    toId,
    initState,
    append,
    createElement,
    h,
    watch,
    empty,
    persist,
    replace,
    setText,
    css,
    sub,
  })
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