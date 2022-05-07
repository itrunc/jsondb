const { createCipheriv, createDecipheriv, randomBytes } = require('crypto')
const { name: packageName } = require('../package.json')
const logger = require('debug')(`${packageName}:security`)

const ALGORITHM = process.env.JSONDB_ENC_ALGORITHM || 'aes-256-gcm'
const KEY = process.env.JSONDB_ENC_KEY || '63d55d3ab027c0ee93abaf6b3f471d5f5764250237cd6c6ff028dd26d52ad914f172ea2eb7358238c166ca06e3c76be955e4b5e9677c8b872f719fbfe2dc8435ee8d86f39967154ea557606b43a49c6dd5f05b355e0623316aefd983a4891847c093980b404a255288c6ed3e664e85e47af8f9cc522c8df035e59b288c7c5a47715907967877432a23d90989257178423cd6f67ef0492b59dbff0fb3bab6e931e8674396a53da21bdb194c9d243b20e3219452e8fc498e12e0547488102e46bcca68e657b1305880cd997fab8fa42befbc900ba4bcdd935524a3a1eee76836973d8d2dcb6c5dafe7eea930e968047174748e70b0a13761941860a03d857aeb0f'
const KEY_LENGTH = process.env.JSONDB_ENC_KEY_LEN || 32 // If the algorithm is 128, then this value is 16
const IV_LENGTH = process.env.JSONDB_ENC_IV_LEN || 32

function encrypt(data, iv) {
  const debug = logger.extend('encrypt')
  try {
    const cipher = createCipheriv(
      ALGORITHM,
      KEY.toString('hex').slice(0, KEY_LENGTH),
      iv.toString('hex').slice(0, IV_LENGTH)
    )
    const encrypted = cipher.update(data)
    return encrypted.toString('hex')
  } catch (error) {
    debug('Error occurred', error)
    throw new Error(`Encryption Error: ${error && error.message}`)
  }
}

function decrypt(data, iv) {
  const debug = logger.extend('decrypt')
  try {
    const encryptedText = Buffer.from(data, 'hex')
    const decipher = createDecipheriv(
      ALGORITHM,
      KEY.toString('hex').slice(0, KEY_LENGTH),
      iv.toString('hex').slice(0, IV_LENGTH)
    )
    const deciphered = decipher.update(encryptedText)
    return deciphered.toString()
  } catch (error) {
    debug('Error occurred', error)
    return false
  }
}

function token(size) {
  const debug = logger.extend('token')
  return new Promise((resolve, reject) => {
    size = size || 12
    randomBytes(size, (err, buf) => {
      if (err) {
        debug('Error occurred', err)
        return reject(err)
      }
      return resolve(buf.toString('hex'))
    })
  })
}

module.exports = {
  encrypt,
  decrypt,
  token
}