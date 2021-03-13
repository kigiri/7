# 7
Minimalist webRTC of the 7wonders duel gameplay


## Why ?

Small games are fun to programs, I wanted a good excuses to try some webRTC. \
Also, for testing different ways to structure javascript code.

Very naive everything, very fast and simple too.

I want to see at which point the complexity breaks it.


### NoStack unified server + client

I'm experimenting with a 0 tooling approach, the server is the bundler.
I colocated server and client code, I'm very not sure about this.

I like that it's a very raw "code is just a string" bundling / meta programing
experience, like if I want to have env variables in my build,
I can just pass them as JSON somewhere.

It was possible to generate routes from the server,
This help you too call routes that actually exists
and require very little code

for example, the websocket file looks like that:
```js
import _ws from 'ws'

// SERVER HANDELING
export const events = {}
export const on = key => {
  if (events[key]) throw Error(`event ${key} already registered`)
  const trigger = Event()
  exportJS(`WS.${key} = data => WS.send('${key}', data)`)
  return (events[key] = trigger).on
}

new _ws.Server({ server }).on('connection', (ws, req) => {
  ws.on('message', message => {
    const data = JSON.parse(message)
    // handle user input
    const handler = events[type]
    if (!handler) return console.log('not found', { type, data })
    console.log('WS:on', type, data)
    return handler({ data, client })
  })
})

// CLIENT MODULE
exportJS(function WS({ serverUrl }) {
  const socket = new WebSocket(serverUrl)
  WS.connection = new Promise((resolve, reject) => {
    socket.onopen = resolve
    socket.onerror = reject
  })

  WS.send = (type, data) => socket.send(JSON.stringify({type, data}))

  // This little reconnectAndReload allow live reload in 7 lines:
  socket.onclose = async function reconnectAndReload(e) {
    setTimeout(() => { // if no timeout, firefox go BRRRRR
      const s = new WebSocket('ws://localhost:8080')
      s.onopen = () => location.reload()
      s.onclose = s.onerror = reconnectAndReload
    }, 1000)
  }
}, { serverUrl: 'ws://localhost:8080' })
```

So far I kinda like to not have too many files, but let's see how that scale up.

#### Trades offs
- error prone
- no source maps, lines from error don't match actual files
  *(I started to look at generating them, but gave up)*
- messy imports / exports
- extra level of indentation in the client
- can feel a bit magic, in a bad way, like wtf is going on.


### Goals
- avoid external libraries
- have fun
- make it fast & interactive
- EOP Architecture (Emoji oriented programing)

### WebRTC Signaling

I do the WebRTC signaling with a websocket server.
It was a bit hard to do, because the spec is still very much in shift,
you find outdated examples even on the official doc. \
Errors sometimes have no description *(ex: "DOM Execption", AKA, good luck and F U)*

I had one because I was trying to register the `iceCandidate` too soon, almost gave up on this :(

> *for more see the `rtc.js` file*

### `rtc.js` WebRTC P2P chanel

for that I decided to try to represent all my needed state as a very small message
```js
const ACTION_COUNT = size; size++ // Uint8
const INTERACTION = size; size++ // Uint8
const LAST_TARGET = size; size++ // Uint8
const X = size; size+=4 // Float32
const Y = size; size+=4 // Float32
```
`X` & `Y` are the mouse coordinates, not needed but fun I think.
`ACTION_COUNT` total actions made, used for syncing state
`INTERACTION` is what the mouse play with (hover or grabbing)
`LAST_TARGET` is the last target of the latest game event
I plan to use it to confirm plays and specify types of actions

This is what I got so far, the idea is that it's small enough
to just stream all the changes through the channel.

I will see if I need to throotle it / handle reconnection and all that

I've no clues about what is actually handled by WebRTC or not, didn't read the spec.

In the first message I exchange a `seed`
I used a seeded random to allow everything else to be derived from that


### `ws.js` WebSocket

I love websocket, dunno why, it's fun, had to refrain myself for
writting a full RPC framework

I just slap functions into an object and use the `key` as my route. \
JSON everything into that bad boy and call it a day


### `game.js` THE GAME !!!

I start by defining statically all the cards description, costs and effects. \
I found that using emoji allow to make this whole thing very compact and visual
```js
const cards = [
  I('🟡', 'Clay Reserve', discount('🧱'), cost(3)),
  /* ... */
  II('🟢', 'Dispensary', science('⚗️2'), cost('🧱🧱⛰️')),
  /* ... */
  III('🔴', 'Fortifications', military(2), cost('⛰️⛰️🧱📜')),
  /* ... */
]
```
> Turn's out you can spread emoji to (almost) properly split them: \
> `[...'🧱🧱']` -> `['🧱','🧱']` \
> Where as `'🧱🧱'.split('')` -> `[ '�', '�', '�', '�' ]` !

Then we have the Ages card layouts,
I wanted something visual so, I generated them from this template:
```js
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
```
> the characters are index of them in a 6x7 grid
> converted to base36 for a smaller formating

I then send the whole generated data as JSON to avoid bloating the client with
JS needed just for generating it.

I'm pretty sure once gzip'd it's going to be similar anyway, and faster for the client

> Little tricks if you have big data like this, send it as a string and `JSON.parse` it
> in the client, because parsing JS is way harder than `JSON` :)

For now the only logic done is shuffling the cards for each ages
and initializing the seed for everyone


### `ui.js` The UI

Emoji everything:
- I don't have time & skills too make illustrations
- Images are heavy

Then I try to make it look not too ugly while doing it mostly in CSS.

I generate everything in JS, both Element and Style.

Not because I hate HTML or CSS, but just because I like being able
to generate big chuncks of it using JS.

I try to do the reverse of what ppl usualy do:
 - Use JS to generate CSS logic
 - limit the use of JS to a minimum by relying on CSS for most of it

I also like to have my style and my components close together, not in separate files.

For the state, I use events, which allows me to subscribe to changes
from the game state and react accordingly or trigger those that are initiated from the UI.

### Screenshots
![image](https://user-images.githubusercontent.com/231748/110866518-89fa9100-82c5-11eb-9994-1f0bc870dc29.png)


## TODO

- [X] Connect 2 session with webRTC and share UI state
- [X] Model basic game cards
- [X] Basic cards UI & Interactions
- [ ] Sell a card
- [ ] Build a card
- [ ] Have way to fiddle with your cards while you wait for the other player
- [ ] Basic cards game logic *(working on it)*
- [ ] Model special cards game model
- [ ] special cards game logic
- [ ] Full game UI (gold counter & co)
- [ ] Handle wonders selection phase
- [ ] Build a wonder
- [ ] Handle wonders effects
- [ ] Wining / Loosing events
- [ ] front end for sharing sessions
- [ ] Lobby to host and join public sessions
- [ ] Cleanup websocket connections after RTC chanel is open
- [ ] Handle connection loss and recover pending game state
- [ ] Compress index in brotli & gzip
- [ ] minify a bit the JS *(trim white spaces && remove comments)*
- [ ] Low Graphism mode for slow computers (no animations & no box-shadows)
- [ ] Rewrite bundler in Deno
- [ ] Rewrite the server in rust
