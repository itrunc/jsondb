const path = require('path')
const fs = require('fs')

const checkPath = (_path) => {
  if (!_path) return false
  if (typeof _path !== 'string') return false
  if (process.platform === 'win32' && /[<>:"|?*]/.test(_path.replace(path.parse(path.resolve(_path)).root, ''))) return false
  return true
}

const getMode = (options) => {
  const defaults = { mode: 0o777 }
  if (typeof options === 'number') return options
  return ({ ...defaults, ...options }).mode
}

// For those system disable mkdir with recursive
const ensureDirSync = (dir, options) => {
  if (checkPath(dir)) {
    dir = path.resolve(dir)
    if (!fs.existsSync(dir)) {
      const parent = path.dirname(dir)
      if (!fs.existsSync(parent)) ensureDirSync(parent)
      fs.mkdirSync(dir, {
        mode: getMode(options),
        recursive: true
      })
    }
  }
}

// const readJsonSync = (file) => {
//   // TODO
// }

// const outputJsonSync = (file, data) => {
//   // TODO
// }

// const removeSync = (_path) => {
//   // TODO
// }

const keyValidate = (key) => {
  if (typeof key === 'string' && key.trim()) {
      return /^[^\/\\\:\*\?\"\<\>\|]+$/i.test(key)
  }
  return false
}

module.exports = {
  ensureDirSync,
  keyValidate
}
