const crypto = require('crypto')

const cached = []
const SIZE = 256 * 16
let buffer
let idx = 256

while (idx--) {
  cached[idx] = (idx + 256).toString(16).substring(1)
}

module.exports = (len = 12) => {
  let str = ''
  let num = (1 + len) / 2 | 0
  if (!buffer || (idx + num) > SIZE) {
    buffer = crypto.randomBytes(SIZE)
    idx = 0
  }

  while(num--) {
    str += cached[buffer[idx++]]
  }

  return str.substring(0, len)
}
