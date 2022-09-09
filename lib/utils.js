const moment = require('moment')
const uid = require('./uid')
const Schema = require('./schema')
const { createLogger } = require('./helper')
const logger = {
  silly: createLogger('silly:utils'),
  debug: createLogger('debug:utils'),
  info: createLogger('info:utils'),
  warn: createLogger('warn:utils'),
  error: createLogger('error:utils')
}

const comparison = (item, criteria, keys) => {
  if (Array.isArray(keys) && keys.length) {
    return keys.every(key => {
      const q = criteria[key]
      const v = item[key]
      if (Array.isArray(q)) { // query with array
        if (Array.isArray(v)) return q.some(i => v.includes(i))
        return q.includes(v)
      } else if (typeof q === 'object') {
        let hit = false
        const calc = q.calc || q.op
        let src = q.value
        let target = v
        if (q.date_format && target) {
          const date = moment.utc(target)
          if (date.isValid()) target = date.format(q.date_format)
        }
        if (q.ignore_case && target && typeof target === 'string') {
          target = target.toUpperCase().trim()
          if (Array.isArray(src)) src = src.map(i => typeof i === 'string' && i.toUpperCase().trim() || i)
        }
        switch(calc.toString().toLowerCase().trim()) {
          case 'like':
          case '%':
            hit = typeof src === 'string' && (new RegExp(src, 'ig')).test(target) || false
            break
          case 'eq':
          case '=':
            hit = target === src
            break
          case 'gt':
          case '>':
            hit = target > src
            break
          case 'ge':
          case '>=':
            hit = target >= src
            break
          case 'lt':
          case '<':
            hit = target < src
            break
          case 'le':
          case '<=':
            hit = target <= src
            break
          case 'has': // has the prop
            hit = target !== undefined
            break
          case 'in':
            hit = Array.isArray(src) && src.includes(target)
            break
          case 'between':
            if (Array.isArray(src)) {
              if (src.length > 1) {
                hit = target >= src[0] && target <= src[1]
              } else if (src.length) {
                hit = target >= src[0]
              }
            }
            break
          default:
            break
        }
        if (q.not) return !hit
        return hit
      } else if (q === false) {
        return v === false || v === undefined
      } else if (q !== undefined) {
        if (Array.isArray(v)) return v.includes(q)
        return q === v
      } else {
        return true
      }
    })
  }
  return true
}

class JsondbUtils {
  constructor(instance, appid, name, {
    year = (new Date()).getFullYear(),
    schemas = {}
  } = {}) {
    if (!instance instanceof Schema) throw new Error('Invalid Instance')
    if (!appid) throw new Error(`Invalid Appid ${appid}`)
    if (!schemas[name]) throw new Error(`Invalid schema ${name}`)
    this.name = name
    this.year = `${year}`
    this.appid = `${appid}`
    this._models = schemas[name]
    this._schema = instance.schema(appid).schema(name)
    this.cached = {
      models: {}
    }
    logger.silly(`Schema ${appid}.${name} is initialized`, { func: 'constructor', appid, schema: name, year, models: this._models })
  }

  get schema() {
    return this._schema
  }

  checkModelExistence(name) {
    const func = 'checkModelExistence'
    const logs = { func, parameters: { name }}
    const exist = this.name === 'temp' || !!this._models[name]
    logger.debug(`Checking model ${name} existence: ${exist}`, { ...logs })
    return exist
  }

  getModel(name, { user = {}, year } = {}) {
    const func = 'getModel'
    year = year || this.year
    const logs = { func, parameters: { name, year, user }}
    const userid = user.id
    const def = this._models[name] || this.name === 'temp' && { name }
    if (!def) {
      logger.warn(`Model ${this.appid}.${this.name}.${name} is not defined`, { ...logs })
      return
    }
    if (def.personal && !userid) {
      logger.warn(`User ID is required for personal model ${name}`, { ...logs })
      return 
    }
    let KEY = `${this.name}.${def.name}`
    const MODEL_NAME = def.name
    if (def.personal) KEY = `${KEY}.${userid}`
    if (def.yearly) KEY = `${KEY}.${year}`
    if (KEY && !this.cached.models[KEY]) {
      let schema = this._schema
      if (def.personal) schema = schema.schema(userid)
      if (def.yearly) schema = schema.schema(`${year}`)
      this.cached.models[KEY] = schema.model(MODEL_NAME, { rules: def.rules, indexes: def.indexes, audit: def.audit })
      logger.info(`Model ${this.appid}.${this.name}.${name} is loaded with key ${KEY}`, { ...logs, def })
    }
    return this.cached.models[KEY]
  }

  removeModel(name, { user = {}, year } = {}) { // Dangerous: all objects in the model will been removed
    const func = 'removeModel'
    year = year || this.year
    const logs = { func, parameters: { name, year, user }}
    const userid = user.id
    const def = this._models[name] || this.name === 'temp' && { name }
    if (!def) {
      logger.warn(`Model ${this.appid}.${this.name}.${name} is not defined`, { ...logs })
      return
    }
    if (def.personal && !userid) {
      logger.warn(`User ID is required for personal model ${name}`, { ...logs })
      return 
    }
    let KEY = `${this.name}.${def.name}`
    const MODEL_NAME = def.name
    if (def.personal) KEY = `${KEY}.${userid}`
    if (def.yearly) KEY = `${KEY}.${year}`
    let schema = this._schema
    if (def.personal) schema = schema.hasSchema(userid) && schema.schema(userid) || schema
    if (def.yearly) schema = schema.hasSchema(`${year}`) && schema.schema(`${year}`) || schema
    if (schema.hasModel(MODEL_NAME)) {
      schema.removeModel(MODEL_NAME)
      logger.info(`Model ${this.appid}.${this.name}.${name} has been removed`, { ...logs })
      if (this.cached.models[KEY]) delete this.cached.models[KEY]
    }
  }

  checkObjectExistence(name, idOrComparison, { year, user } = {}) {
    const func = 'checkObjectExistence'
    const objectId = typeof idOrComparison !== 'function' && idOrComparison || undefined
    const compare = typeof idOrComparison === 'function' && idOrComparison
    const logs = { func, parameters: { name, objectId, year, user }}
    const model = this.getModel(name, { year, user })
    if (model) {
      if (compare) {
        const count = model.countOf(compare)
        logger.debug(`Check object ${name} count with specific criteria: ${count}`, { ...logs })
        return count > 0
      } else if (objectId) {
        const exist = model.has(objectId)
        logger.debug(`Check object ${name}(${objectId}) existence: ${exist}`, { ...logs })
        return exist
      }
    }
    return false
  }

  async retrieveObjects(name, {
    year, user,
    version = false,
    safe = true,
    criteria = {},
    pagination = {}
  } = {}) {
    const func = 'retrieveObjects'
    const logs = { func, parameters: { name, criteria, pagination, year, version, user, safe }}
    try {
      const model = this.getModel(name, { year, user })
      if (!model) throw new Error(`Model ${name} is not found`)
      let objects = model.findAll(item => comparison(item, criteria, Object.keys(item)), {
        ...pagination
      }).map(({ id, data = {}, index } = {}) => {
        return { id, ...data }
      })
      logger.info(`${objects.length} objects are retrieved from ${name}`, { ...logs })
      if (safe) {
        objects = objects.filter(item => comparison(item, criteria, Object.keys(criteria)))
        logger.info(`${objects.length} objects are retrieved from ${name} with safe mode`, { ...logs })
      }
      if (version) {
        return Promise.resolve({ version: model.version, objects })
      }
      return Promise.resolve(objects)
    } catch (error) {
      const message = `Error on ${func}: ${error && error.message}`
      logger.error(message, { ...logs, error })
      return Promise.reject(new Error(message))
    }
  }

  async retrieveMetaData(name, {
    year, user,
    safe = true,
    criteria = {}
  } = {}) {
    const func = 'retrieveMetaData'
    const logs = { func, parameters: { name, criteria, year, user, safe }}
    try {
      const model = this.getModel(name, { year, user })
      if (!model) throw new Error(`Model ${name} is not found`)
      const meta = model.meta && model.meta.data || {}
      let filtered = Object.entries(meta).filter(([key, item]) => comparison(item, criteria, Object.keys(item)))
      logger.info(`${filtered.length} items are retrieved from meta of ${name}`, { ...logs })
      if (safe) {
        filtered = filtered.filter(([key, item]) => comparison(item, criteria, Object.keys(criteria)))
        logger.info(`${filtered.length} items are retrieved from meta of ${name} with safe mode`, { ...logs })
      }
      const data = filtered.reduce((acc, [key, item]) => {
        acc[key] = item
        return acc
      }, {})
      return Promise.resolve(data)
    } catch (error) {
      const message = `Error on ${func}: ${error && error.message}`
      logger.error(message, { ...logs, error })
      return Promise.reject(new Error(message))
    }
  }

  async saveObjects(name, data, { year, user = {}, indexes } = {}) {
    const func = 'saveObjects'
    const logs = { func, parameters: { name, year, user, indexes }}
    try {
      if (!Array.isArray(data)) throw new Error('Invalid data')
      const model = this.getModel(name, { year, user })
      if (!model) throw new Error(`Model ${name} is not found`)
      const result = await model.mset(data, { who: user.id, indexes }).catch(error => {
        logger.warn(`Error on saving objects to ${name}: ${error && error.message}`, { ...logs, data, user, error })
      })
      let { success = [], failure = [] } = result || {}
      if (failure.length) {
        const getReason = error => {
          let message = `${error && error.message}: ` || ''
          if (error && error.errors) {
            error.errors.forEach(err => {
              if (err.message) message = `${message}${err.message}, `
            })
          }
          return message
        }
        failure = failure.map(({ error, ...item }) => {
          return { ...item, _reason_: getReason(error) }
        })
      }
      logger.info(`${success.length} objects are saved to ${name}, expected: ${data.length}, failed: ${failure.length}`, { ...logs, failure })
      return Promise.resolve({ success, failure })
    } catch (error) {
      const message = `Error on ${func}: ${error && error.message}`
      logger.error(message, { ...logs, error })
      return Promise.reject(new Error(message))
    }
  }

  importObjects(name, data, options = {}) { // alias of saveObjects
    return this.saveObjects(name, data, options)
  }

  async createObject(name, {
    code, createdBy, createdAt, updatedBy, updatedAt, // fields are not allowed to update
    id: objectId = code || uid(process.env.JSONDB_ID_LENGHT && parseInt(process.env.JSONDB_ID_LENGHT) || 8),
    ...data
  } = {}, { year, user = {}, override } = {}) {
    const func = 'createObject'
    const logs = { func, parameters: { name, year, user, override }}
    try {
      const model = this.getModel(name, { year, user })
      if (!model) throw new Error(`Model ${name} is not found`)
      if (model.has(objectId) && !override) throw new Error(`Failed to create object ${name}(${objectId}), it has existed`)
      const created = await model.set(objectId, data, { who: user.id }).catch(error => {
        logger.warn(`Error on saving object ${name}(${objectId}): ${error && error.message}`, { ...logs, data, user, error })
      })
      if (created) {
        logger.info(`Object ${name}(${objectId}) is created`, { ...logs })
        return Promise.resolve({ id: objectId, ...created })
      } else {
        throw new Error(`Failed to create object ${name}(${objectId})`)
      }
    } catch (error) {
      const message = `Error on ${func}: ${error && error.message}`
      logger.error(message, { ...logs, error })
      return Promise.reject(new Error(message))
    }
  }

  async getObject(name, objectId, {
    year, user,
    includeAllFields = false
  } = {}) {
    const func = 'getObject'
    const logs = { func, parameters: { name, year, user, objectId, includeAllFields }}
    try {
      const model = this.getModel(name, { year, user })
      if (!model) throw new Error(`Model ${name} is not found`)
      const item = objectId && typeof objectId === 'string' && model.get(objectId, { includeAllFields })
      if (item) {
        item.id = item.id || objectId
        logger.info(`Object ${name}(${objectId}) is fetched`, { ...logs })
      } else {
        logger.warn(`Object ${name}(${objectId}) is not found`, { ...logs })
      }
      return Promise.resolve(item)
    } catch (error) {
      const message = `Error on ${func}: ${error && error.message}`
      logger.error(message, { ...logs, error })
      return Promise.reject(new Error(message))
    }
  }

  async getObjects(name, idList, {
    year, user,
    includeAllFields = false
  } = {}) {
    const func = 'getObjects'
    const logs = { func, parameters: { name, year, user, idList, includeAllFields }}
    try {
      if (!Array.isArray(idList)) throw new TypeError(`Invalid ID list ${typeof idList}`)
      const result = { success: [], failure: [] }
      logger.debug(`${idList.length} objects will be fetched from ${name}`, { ...logs })
      for (const objectId of idList) {
        const item = await this.getObject(name, objectId, { year, user, includeAllFields }).catch(error => {
          const message = error && error.message
          result.failure.push({ id: objectId, reason: message })
          logger.warn(`Error on getting object ${name}(${objectId}): ${message}`, { ...logs, error })
        })
        if (item) {
          result.success.push(item)
        } else{
          result.failure.push({ id: objectId, reason: 'Not Found' })
        }
      }
      return Promise.resolve(result)
    } catch (error) {
      const message = `Error on ${func}: ${error && error.message}`
      logger.error(message, { ...logs, error })
      return Promise.reject(new Error(message))
    }
  }

  async updateObject(name, objectId, {
    id, code, createdBy, createdAt, updatedBy, updatedAt, // fields are not allowed to update
    ...data
  } = {}, { year, user = {}, create } = {}) {
    const func = 'updateObject'
    const logs = { func, parameters: { name, year, user, objectId, create }}
    try {
      const model = this.getModel(name, { year, user })
      if (!model) throw new Error(`Model ${name} is not found`)
      if (!model.has(objectId) && !create) throw new Error(`Failed to update object ${name}(${objectId}), it is not found`)
      const updated = await model.set(objectId, data, { who: user.id }).catch(error => {
        logger.warn(`Error on saving object ${name}(${objectId}): ${error && error.message}`, { ...logs, data, user, error })
      })
      if (updated) {
        logger.info(`Object ${name}(${objectId}) is updated`, { ...logs })
        return Promise.resolve({ id: objectId, ...updated })
      } else {
        throw new Error(`Failed to save object ${name}(${objectId})`)
      }
    } catch (error) {
      const message = `Error on ${func}: ${error && error.message}`
      logger.error(message, { ...logs, error })
      return Promise.reject(new Error(message))
    }
  }

  async deleteObject(name, objectId, { year, user } = {}) {
    const func = 'deleteObject'
    const logs = { func, parameters: { name, year, user, objectId }}
    try {
      const model = this.getModel(name, { year, user })
      if (!model) throw new Error(`Model ${name} is not found`)
      // checking object linkage
      const { linked } = this._models[name] || {}
      if (linked && typeof linked === 'object') {
        for (const [refModel, refField] of Object.entries(linked)) {
          const compare = item => {
            if (Array.isArray(item[refField])) return item[refField].includes(objectId)
            return item[refField] === objectId
          }
          if (this.checkObjectExistence(refModel, compare, { user, year })) {
            logger.warn(`Unable to delete object ${name}(${objectId}), it is linked by ${refModel}(${refField})`, { ...logs })
            throw new Error(`Unable to delete object ${objectId}, it is linked by another object`)
          }
        }
      }
      const deleted = await model.del(objectId).catch(error => {
        logger.warn(`Error on deleting object ${name}(${objectId}): ${error && error.message}`, { ...logs, error })
      })
      if (deleted) {
        logger.info(`Object ${name}(${objectId}) is deleted`, { ...logs, user, deleted })
        return Promise.resolve({ id: objectId, ...deleted })
      } else {
        return Promise.resolve(null)
      }
    } catch (error) {
      const message = `Error on ${func}: ${error && error.message}`
      logger.error(message, { ...logs, error })
      return Promise.reject(new Error(message))
    }
  }

  async deleteObjects(name, idList, { year, user, criteria } = {}) {
    const func = 'deleteObjects'
    const logs = { func, parameters: { name, year, user, idList, criteria }}
    try {
      let objects = []
      const deleted = { success: [], failure: [] }
      if (Array.isArray(idList) && idList.length) {
        logger.debug(`${idList.length} objects will be fetched from ${name}`, { ...logs })
        const { success = [], failure = [] } = await this.getObjects(name, idList, { year, user }).catch(error => {
          logger.warn(`Error on getting objects from ${name}: ${error && error.message}`, { ...logs, error, objectIds: idList })
        }) || {}
        objects = success
        deleted.failure = deleted.failure.concat(failure)
        logger.info(`${success.length} objects are fetched from ${name}, expected: ${idList.length}, failed: ${failure.length}`, { ...logs, failure })
      } else if (criteria) {
        logger.debug(`Retrieving objects from ${name} with criteria`, { ...logs })
        objects = await this.retrieveObjects(name, { year, user, criteria }).catch(error => {
          logger.warn(`Error on retrieving objects from ${name}: ${error && error.message}`, { ...logs, error })
        }) || []
        logger.info(`${objects.length} objects are fetched from ${name}`, { ...logs })
      }
      if (objects.length) {
        for (const obj of objects) {
          await this.deleteObject(name, obj.id, { year, user }).then(item => {
            if (item) {
              deleted.success.push(item)
            } else {
              deleted.failure.push({ ...obj, reason: 'delete failed' })
            }
          }).catch(error => {
            deleted.failure.push({ ...obj, reason: error && error.message })
          })
        }
      }
      return Promise.resolve(deleted)
    } catch (error) {
      const message = `Error on ${func}: ${error && error.message}`
      logger.error(message, { ...logs, error })
      return Promise.reject(new Error(message))
    }
  }

  deleteObjectsByID(name, list, { year, user } = {}) {
    if (!Array.isArray(list)) list = [list]
    return this.deleteObjects(name, list, { year, user })
  }

  deleteObjectsWithCriteria(name, criteria = {}, { year, user } = {}) {
    return this.deleteObjects(name, undefined, { year, user, criteria })
  }
}

module.exports = JsondbUtils
