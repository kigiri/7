import { readFileSync } from 'fs'

import { onRequest, server, indexJS } from './nostack.js'

import './ws.js'
import './game.js'
import './rtc.js'

indexJS.push(readFileSync('./ui.js', 'utf8'))

server.listen(8080, err => {
  if (!err) return console.log('Listening on port', 8080)
  console.log(err)
  Process.exit(1)
})
