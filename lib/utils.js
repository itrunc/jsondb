const uid = require('./uid')
const Schema = require('./schema')
const { comparison } = require('./helper')

class JsondbUtils {
  constructor(instance, appid, name, {
    year = (new Date()).getFullYear(),
    schemas = {},
    logger
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
    if (logger) {
      this.logger = logger
    } else {
      this.logger = require('./logger')('utils')
    }
    this.logger.silly(`Schema ${appid}.${name} is initialized`, { func: 'constructor', appid, schema: name, year, models: this._models })
  }

  get schema() {
    return this._schema
  }

  checkModelExistence(name) {
    const func = 'checkModelExistence'
    const logs = { func, params: { name }}
    const exist = this.name === 'temp' || !!this._models[name]
    this.logger.debug(`Checking model ${name} existence: ${exist}`, { ...logs })
    return exist
  }

  getModel(name, { user = {}, year } = {}) {
    const func = 'getModel'
    year = year || this.year
    const logs = { func, params: { name, year, user }}
    const userid = user.id
    const def = this._models[name] || this.name === 'temp' && { name }
    if (!def) {
      this.logger.warn(`Model ${this.appid}.${this.name}.${name} is not defined`, { ...logs })
      return
    }
    if (def.personal && !userid) {
      this.logger.warn(`User ID is required for personal model ${name}`, { ...logs })
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
      this.cached.models[KEY] = schema.model(MODEL_NAME, {
        rules: def.rules, indexes: def.indexes, audit: def.audit,
        logger: !this.logger.dev && this.logger || undefined
      })
      this.logger.info(`Model ${this.appid}.${this.name}.${name} is loaded with key ${KEY}`, { ...logs, def })
    }
    return this.cached.models[KEY]
  }

  removeModel(name, { user = {}, year } = {}) { // Dangerous: all objects in the model will been removed
    const func = 'removeModel'
    year = year || this.year
    const logs = { func, params: { name, year, user }}
    const userid = user.id
    const def = this._models[name] || this.name === 'temp' && { name }
    if (!def) {
      this.logger.warn(`Model ${this.appid}.${this.name}.${name} is not defined`, { ...logs })
      return
    }
    if (def.personal && !userid) {
      this.logger.warn(`User ID is required for personal model ${name}`, { ...logs })
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
      this.logger.info(`Model ${this.appid}.${this.name}.${name} has been removed`, { ...logs })
      if (this.cached.models[KEY]) delete this.cached.models[KEY]
    }
  }

  checkObjectExistence(name, idOrComparison, { year, user } = {}) {
    const func = 'checkObjectExistence'
    const objectId = typeof idOrComparison !== 'function' && idOrComparison || undefined
    const compare = typeof idOrComparison === 'function' && idOrComparison
    const logs = { func, params: { name, objectId, year, user }}
    const model = this.getModel(name, { year, user })
    if (model) {
      if (compare) {
        const count = model.countOf(compare)
        this.logger.debug(`Check object ${name} count with specific criteria: ${count}`, { ...logs })
        return count > 0
      } else if (objectId) {
        const exist = model.has(objectId)
        this.logger.debug(`Check object ${name}(${objectId}) existence: ${exist}`, { ...logs })
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
    const logs = { func: 'retrieveObjects', params: { name, criteria, pagination, year, version, user, safe }}
    try {
      const model = this.getModel(name, { year, user })
      if (!model) throw new Error(`Model ${name} is not found`)
      let objects = model.findAll(item => comparison(item, criteria, Object.keys(item)), {
        ...pagination
      }).map(({ id, data = {}, index } = {}) => {
        return { id, ...data }
      })
      this.logger.info(`${objects.length} objects are retrieved from ${name}`, { ...logs })
      if (safe) {
        objects = objects.filter(item => comparison(item, criteria, Object.keys(criteria)))
        this.logger.info(`${objects.length} objects are retrieved from ${name} with safe mode`, { ...logs })
      }
      if (version) {
        return Promise.resolve({ version: model.version, objects })
      }
      return Promise.resolve(objects)
    } catch (error) {
      this.logger.error('Error occurred', { ...logs, error })
      return Promise.reject(error)
    }
  }

  async retrieveMetaData(name, {
    year, user,
    safe = true,
    criteria = {}
  } = {}) {
    const logs = { func: 'retrieveMetaData', params: { name, criteria, year, user, safe }}
    try {
      const model = this.getModel(name, { year, user })
      if (!model) throw new Error(`Model ${name} is not found`)
      const meta = model.meta && model.meta.data || {}
      let filtered = Object.entries(meta).filter(([key, item]) => comparison(item, criteria, Object.keys(item)))
      this.logger.info(`${filtered.length} items are retrieved from meta of ${name}`, { ...logs })
      if (safe) {
        filtered = filtered.filter(([key, item]) => comparison(item, criteria, Object.keys(criteria)))
        this.logger.info(`${filtered.length} items are retrieved from meta of ${name} with safe mode`, { ...logs })
      }
      const data = filtered.reduce((acc, [key, item]) => {
        acc[key] = item
        return acc
      }, {})
      return Promise.resolve(data)
    } catch (error) {
      this.logger.error('Error occurred', { ...logs, error })
      return Promise.reject(error)
    }
  }

  async saveObjects(name, data, { year, user = {}, indexes } = {}) {
    const logs = { func: 'saveObjects', params: { name, year, user, indexes }}
    try {
      if (!Array.isArray(data)) throw new Error('Invalid data')
      const model = this.getModel(name, { year, user })
      if (!model) throw new Error(`Model ${name} is not found`)
      const result = await model.mset(data, { who: user.id, indexes }).catch(error => {
        this.logger.warn(`Error on saving objects to ${name}: ${error && error.message}`, { ...logs, data, user, error })
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
      this.logger.info(`${success.length} objects are saved to ${name}, expected: ${data.length}, failed: ${failure.length}`, { ...logs, failure })
      return Promise.resolve({ success, failure })
    } catch (error) {
      this.logger.error('Error occurred', { ...logs, error })
      return Promise.reject(error)
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
    const logs = { func: 'createObject', params: { name, year, user, override }}
    try {
      const model = this.getModel(name, { year, user })
      if (!model) throw new Error(`Model ${name} is not found`)
      if (model.has(objectId) && !override) throw new Error(`Failed to create object ${name}(${objectId}), it has existed`)
      const created = await model.set(objectId, data, { who: user.id }).catch(error => {
        this.logger.warn(`Error on saving object ${name}(${objectId}): ${error && error.message}`, { ...logs, data, user, error })
      })
      if (created) {
        this.logger.info(`Object ${name}(${objectId}) is created`, { ...logs })
        return Promise.resolve({ id: objectId, ...created })
      } else {
        throw new Error(`Failed to create object ${name}(${objectId})`)
      }
    } catch (error) {
      this.logger.error('Error occurred', { ...logs, error })
      return Promise.reject(error)
    }
  }

  async getObject(name, objectId, {
    year, user,
    includeAllFields = false
  } = {}) {
    const logs = { func: 'getObject', params: { name, year, user, objectId, includeAllFields }}
    try {
      const model = this.getModel(name, { year, user })
      if (!model) throw new Error(`Model ${name} is not found`)
      const item = objectId && typeof objectId === 'string' && model.get(objectId, { includeAllFields })
      if (item) {
        item.id = item.id || objectId
        this.logger.info(`Object ${name}(${objectId}) is found`, { ...logs })
      } else {
        this.logger.warn(`Object ${name}(${objectId}) is not found`, { ...logs })
      }
      return Promise.resolve(item)
    } catch (error) {
      this.logger.error('Error occurred', { ...logs, error })
      return Promise.reject(error)
    }
  }

  async getObjectAudits(name, objectId, { year, user } = {}) {
    const logs = { func: 'getObjectAudit', params: { name, year, user, objectId }}
    try {
      const item = await this.getObject(name, objectId, { year, user, includeAllFields: true })
      const audits = item.__audit__ || []
      this.logger.info(`${audits.length} audits in object ${name}(${objectId}) are found`, { ...logs })
      return Promise.resolve(audits)
    } catch (error) {
      this.logger.error('Error occurred', { ...logs, error })
      return Promise.reject(error)
    }
  }

  async getObjects(name, idList, {
    year, user,
    includeAllFields = false
  } = {}) {
    const logs = { func: 'getObjects', params: { name, year, user, idList, includeAllFields }}
    try {
      if (!Array.isArray(idList)) throw new TypeError(`Invalid ID list ${typeof idList}`)
      const result = { success: [], failure: [] }
      this.logger.debug(`${idList.length} objects will be fetched from ${name}`, { ...logs })
      for (const objectId of idList) {
        const item = await this.getObject(name, objectId, { year, user, includeAllFields }).catch(error => {
          const message = error && error.message
          result.failure.push({ id: objectId, reason: message })
          this.logger.warn(`Error on getting object ${name}(${objectId}): ${message}`, { ...logs, error })
        })
        if (item) {
          result.success.push(item)
        } else{
          result.failure.push({ id: objectId, reason: 'Not Found' })
        }
      }
      return Promise.resolve(result)
    } catch (error) {
      this.logger.error('Error occurred', { ...logs, error })
      return Promise.reject(error)
    }
  }

  async updateObject(name, objectId, {
    id, code, createdBy, createdAt, updatedBy, updatedAt, // fields are not allowed to update
    ...data
  } = {}, { year, user = {}, create } = {}) {
    const logs = { func: 'updateObject', params: { name, year, user, objectId, create }}
    try {
      const model = this.getModel(name, { year, user })
      if (!model) throw new Error(`Model ${name} is not found`)
      if (!model.has(objectId) && !create) throw new Error(`Failed to update object ${name}(${objectId}), it is not found`)
      const updated = await model.set(objectId, data, { who: user.id }).catch(error => {
        this.logger.warn(`Error on saving object ${name}(${objectId}): ${error && error.message}`, { ...logs, data, user, error })
      })
      if (updated) {
        this.logger.info(`Object ${name}(${objectId}) is updated`, { ...logs })
        return Promise.resolve({ id: objectId, ...updated })
      } else {
        throw new Error(`Failed to save object ${name}(${objectId})`)
      }
    } catch (error) {
      this.logger.error('Error occurred', { ...logs, error })
      return Promise.reject(error)
    }
  }

  async deleteObject(name, objectId, { year, user } = {}) {
    const logs = { func: 'deleteObject', params: { name, year, user, objectId }}
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
            this.logger.warn(`Unable to delete object ${name}(${objectId}), it is linked by ${refModel}(${refField})`, { ...logs })
            throw new Error(`Unable to delete object ${objectId}, it is linked by another object`)
          }
        }
      }
      const deleted = await model.del(objectId).catch(error => {
        this.logger.warn(`Error on deleting object ${name}(${objectId}): ${error && error.message}`, { ...logs, error })
      })
      if (deleted) {
        this.logger.info(`Object ${name}(${objectId}) is deleted`, { ...logs, user, deleted })
        return Promise.resolve({ id: objectId, ...deleted })
      } else {
        return Promise.resolve(null)
      }
    } catch (error) {
      this.logger.error('Error occurred', { ...logs, error })
      return Promise.reject(error)
    }
  }

  async deleteObjects(name, idList, { year, user, criteria } = {}) {
    const logs = { func: 'deleteObjects', params: { name, year, user, idList, criteria }}
    try {
      let objects = []
      const deleted = { success: [], failure: [] }
      if (Array.isArray(idList) && idList.length) {
        this.logger.debug(`${idList.length} objects will be fetched from ${name}`, { ...logs })
        const { success = [], failure = [] } = await this.getObjects(name, idList, { year, user }).catch(error => {
          this.logger.warn(`Error on getting objects from ${name}: ${error && error.message}`, { ...logs, error, objectIds: idList })
        }) || {}
        objects = success
        deleted.failure = deleted.failure.concat(failure)
        this.logger.info(`${success.length} objects are fetched from ${name}, expected: ${idList.length}, failed: ${failure.length}`, { ...logs, failure })
      } else if (criteria) {
        this.logger.debug(`Retrieving objects from ${name} with criteria`, { ...logs })
        objects = await this.retrieveObjects(name, { year, user, criteria }).catch(error => {
          this.logger.warn(`Error on retrieving objects from ${name}: ${error && error.message}`, { ...logs, error })
        }) || []
        this.logger.info(`${objects.length} objects are fetched from ${name}`, { ...logs })
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
      this.logger.error('Error occurred', { ...logs, error })
      return Promise.reject(error)
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
