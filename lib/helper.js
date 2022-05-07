const path = require('path')
const fs = require('fs')
const fs2 = require('fs-extra')
const security = require('./security')

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

const readJsonSync = (file, token) => {
  let result = null
  if (!fs.existsSync(file)) return result
  if (!token) {
    result = fs2.readJsonSync(file)
  } else {
    const content = fs.readFileSync(file)
    if (content) {
      const decrypted = security.decrypt(content.toString(), token)
      if (decrypted) {
        result = JSON.parse(decrypted.toString())
      }
    }
  }
  return result
}

const outputJsonSync = (file, data, token) => {
  if (!token) {
    fs2.outputJsonSync(file, data)
  } else {
    const content = JSON.stringify(data)
    const encrypted = security.encrypt(content, token)
    fs.writeFileSync(file, encrypted)
  }
}

// const removeSync = (_path) => {
//   // TODO
// }

const keyValidate = (key) => {
  if (typeof key === 'string' && key.trim()) {
      return /^[^\/\\\:\*\?\"\<\>\|]+$/i.test(key)
  }
  return false
}

const is = (val, type) => {
  return toString.call(val) === `[object ${type}]`;
}

const typeOf = (val) => {
  return toString.call(val)
}

const isObject = (val) => {
  return val !== null && is(val, 'Object')
}

const checkIfSameObject = (obj1, obj2) => {
  if (isObject(obj1) && isObject(obj2)) {
    // If the object includes id, then just compare the objectId
    if (obj1.id === obj2.id) return true
    // Check keys
    const keys1 = Object.keys(obj1).sort()
    const keys2 = Object.keys(obj2).sort()
    if (keys1.join(',') !== keys2.join(',')) return false
    return keys1.every(key => {
      const prop1 = obj1[key]
      const prop2 = obj2[key]
      if (prop1 === prop2) return true
      if (typeOf(prop1) !== typeOf(prop2)) return false
      return checkIfSameObject(prop1, prop2)
    })
  } else if (Array.isArray(obj1) && Array.isArray(obj2)) {
    if (obj1.length !== obj2.length) return false
    const array1IncludeObject = obj1.findIndex(item => typeof item === 'object') > -1
    const array2IncludeObject = obj2.findIndex(item => typeof item === 'object') > -1
    // If the array include sub object, then ignore the comparison. Until I would have a good idea for it
    if (array1IncludeObject || array2IncludeObject) return true
    return obj1.every(val1 => obj2.includes(val1)) && obj2.every(val2 => obj1.includes(val2))
  }
  return false
}

const reAssignObject = (obj) => {
  if (isObject(obj)) {
    return Object.entries(obj).filter(([key]) => {
      return !/^_.*_$/.test(key) && !['createdAt', 'updatedAt'].includes(key)
    }).reduce((acc, [key, value]) => {
      acc[key] = value
      return acc
    }, {})
  }
  return {}
}

const objectDiff = (existed, newObj) => {
  if (isObject(existed) && isObject(newObj)) {
    existed = reAssignObject(existed)
    newObj = reAssignObject(newObj)
    // const existedKeys = Object.keys(existed)
    const newKeys = Object.keys(newObj)
    const props = []
    const before = {}
    const after = {}
    // Ignore because undefined means the property doesn't change
    // const missingKeys = existedKeys.filter(key => !newKeys.includes(key))
    // for (const key of missingKeys) {
    //   props.push(key)
    //   before[key] = existed[key]
    // }
    for(const key of newKeys) {
      // TODO: compare object in value
      const diffType = typeof existed[key] !== typeof newObj[key]
      if ( diffType || typeof newObj[key] !== 'object' && existed[key] !== newObj[key] || typeof newObj[key] === 'object' && !checkIfSameObject(existed, newObj)) {
        props.push(key)
        before[key] = existed[key]
        after[key] = newObj[key]
      }
    }
    return { k: props, b: before, a: after }
  }
  return null
}

const retrieveObject = (data, {
  includeAllFields = true
} = {}) => {
  if (!includeAllFields && isObject(data)) {
    return Object.entries(data).filter(([key]) => !/^_.*_$/.test(key)).reduce((result, [key, value]) => {
      result[key] = value
      return result
    }, {})
  }
  return data
}

module.exports = {
  readJsonSync,
  outputJsonSync,
  ensureDirSync,
  keyValidate,
  objectDiff,
  retrieveObject
}
