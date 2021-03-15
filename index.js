import { readFileSync } from 'fs'

import { server, indexJS } from './nostack.js'

import './ws.js'
import './game.js'
import './encoding.js'
import './rtc.js'

indexJS.push(readFileSync('./ui.js', 'utf8'))

server.listen(process.env.PORT || 8080, err => {
  if (!err) return console.log('Listening on port', process.env.PORT || 8080)
  console.log(err)
  Process.exit(1)
})
