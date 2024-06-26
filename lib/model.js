const os = require('os')
const path = require('path')
const fs2 = require('fs-extra')
const uid = require('./uid')
const { EventEmitter } = require('events')
const ValidateSchema = require('async-validator').default
const { keyValidate, objectDiff, retrieveObject, readJsonSync, readJson, outputJsonSync } = require('./helper')

const DEFAULT_PATH = path.resolve(os.homedir(), `.jsondb-model`)

const defaultMeta = () => {
    return {
        version: 0,
        total: 0,
        data: {}
    }
}

/**
 * Create / Get a model
 */
class Model extends EventEmitter {
    #folder
    #mapfile
    #map
    #metafile
    #meta
    #isnew
    #rules
    #indexes
    #audit
    #encrypt
    /**
     * Create a new model instance
     * @example
     * const model = new Model('path/to/model', {
     *   rules: { name: [{ required: true }] },
     *   indexes: ['type']
     * })
     * 
     * @constructor
     * @param {String} folder - Path to save data of the model
     * @param {ModelConstructorOptions} options
     */
    constructor(folder = DEFAULT_PATH, {
        rules = {},
        indexes = [],
        audit = false,
        logger,
        encrypt
    } = {}) {
        super()

        if (logger) {
            this.logger = logger
        } else {
            this.logger = require('./logger')('model')
        }

        const logs = { func: 'constructor', params: { folder, rules, indexes, audit }}

        this.#rules = rules || {}
        this.#indexes = indexes || []
        this.#audit = audit || false
        this.#encrypt = encrypt

        this.#folder = path.resolve(folder, '.object')
        fs2.ensureDirSync(this.#folder)
        this.logger.silly(`Ensure folder ${this.#folder} created`, { ...logs })

        this.#mapfile = path.resolve(folder, '_f_.json')
        this.#map = readJsonSync(this.#mapfile) || {}

        this.#metafile = path.resolve(folder, '_m_.json')
        const default_meta = defaultMeta()
        const metaData = readJsonSync(this.#metafile)
        if (metaData) {
            this.#meta = { ...default_meta, ...metaData }
            this.#isnew = false 
        } else {
            this.#meta = default_meta
            this.#isnew = true
            this.logger.debug('Create new model', { ...logs })
        }
        this.saveMeta()
    }

    get isNew() {
        return this.#isnew
    }

    get meta() {
        return this.#meta
    }

    get version() {
        return this.#meta.version
    }

    get count() {
        return this.#meta.total || 0
    }

    get keys() {
        const data = this.#meta.data || {}
        return Object.keys(data)
    }

    #keyValidator(key) {
        // return keyValidate(key) // it is not required for model now
        return !!key
    }

    #genFilePath() {
        const date = (new Date()).toISOString()
        const year = date.substring(0, 4)
        const day = date.substring(5, 10)
        let filename = `${Date.now() - Date.parse(date.substring(0, 10))}_${uid(4)}`
        if (!this.#encrypt) filename = `${filename}.json`
        const folder = path.resolve(this.#folder, `${year}`, `${day}`, uid(2))
        fs2.ensureDirSync(folder)
        return path.resolve(folder, filename)
    }

    #genIndex(data, {
        indexes = {} // it could be an array with field name as well
    } = {}) {
        let index = {}
        const fields = Array.isArray(indexes) && Array.from(new Set(indexes.concat(this.#indexes))) || this.#indexes
        if (data && typeof data === 'object' && fields.length > 0) {
            index = fields.reduce((result, prop) => {
                result[prop] = data[prop]
                return result
            }, {})
        }
        if (!Array.isArray(indexes) && typeof indexes === 'object' && indexes) index = { ...index, ...indexes }
        return index
    }

    /**
     * Save cached meta and mapping to filesystem
     * @example
     * const model = new Model()
     * model.saveMeta()
     */
    saveMeta() {
        const logs = { func: 'saveMeta' }
        this.#meta.version = Date.now()
        outputJsonSync(this.#metafile, this.#meta)
        this.logger.silly(`Saved meta ${this.#metafile}`, { ...logs })
        outputJsonSync(this.#mapfile, this.#map)
        this.logger.silly(`Saved file mapping ${this.#mapfile}`, { ...logs })
    }

    /**
     * Check existence of a object with specific key. 
     * @example
     * const model = new Model()
     * model.on('missed', key => console.log(`${key} is missing`))
     * model.has('test')
     * 
     * @param {string} key 
     * @param {ModelHasOptions} options
     * 
     * @returns {boolean}
     */
    has(key, {
        event = false
    } = {}) {
        const logs = { func: 'has', params: { key, event }}
        if (this.#keyValidator(key) && this.count > 0 && this.#meta.data[key] !== undefined && this.#map[key]) {
            return true
        }
        this.logger.warn(`Not found object ${key}`, { ...logs })
        if (event) this.emit('missed', key)
        return false
    }

    /**
     * Get file path of the object with specific key. 
     * @example
     * const model = new Model()
     * const file = model.getFilePath('test')
     * 
     * @param {string} key 
     * @param {ModelHasOptions} options
     * 
     * @returns {string} - If the object not found, empty string will be returned
     */
    getFilePath(key, {
        event = false
    } = {}) {
        const logs = { func: 'getFilePath', params: { key, event }}
        if (this.has(key, { event })) {
            let filename = this.#map[key]
            if (Array.isArray(filename)) filename = filename.join(path.sep)
            const file = path.resolve(this.#folder, filename)
            this.logger.silly(`File path of ${key} is ${file}`, { ...logs })
            return file
        }
        return ''
    }

    /**
     * Get meta of the object with specific key. 
     * @example
     * const model = new Model()
     * const meta = model.getMeta('test')
     * 
     * @param {string} key 
     * @param {ModelHasOptions} options
     * 
     * @returns {object | null} - If the object not found, null will be returned
     */
    getMeta(key, {
        event = false
    } = {}) {
        if (this.has(key, { event })) {
            return this.#meta.data[key]
        }
        return null
    }

    /**
     * Get object with specific key, null will be returned if object not existed
     * @example
     * const model = new Model()
     * model.on('error', (func, err, { key } = {}) => console.log(func, key, err))
     * const data = model.get('key1')
     * console.log(data)
     * 
     * @param {string} key - ID of an object
     * @param {ModelGetOptions} options
     * 
     * @returns {object | null}
     */
    get(key, {
        event = false,
        includeAllFields = false
    } = {}) {
        const logs = { func: 'get', params: { key, event, includeAllFields }}
        let data = null
        try {
            const file = this.getFilePath(key, { event })
            if (file) data = readJsonSync(file, this.#encrypt)
        } catch (error) {
            this.logger.error('Error Occurred', { ...logs, error })
            if (event) this.emit('error', error, { method: 'get', key })
        }
        return retrieveObject(data, { includeAllFields })
    }

    getAudit(key, {
        event = false
    } = {}) {
        const logs = { func: 'get', params: { key, event }}
        let data = null
        try {
            const file = this.getFilePath(key, { event })
            if (file) {
                const auditFile = `${file}.audit`
                data = readJsonSync(auditFile, this.#encrypt)
            }
        } catch (error) {
            this.logger.error('Error Occurred', { ...logs, error })
            if (event) this.emit('error', error, { method: 'get', key })
        }
        return retrieveObject(data, { includeAllFields: true })
    }

    /**
     * Get objects with list of ID
     * @example
     * const model = new Model()
     * model.on('error', (func, err, { key } = {}) => console.log(func, key, err))
     * const data = model.mget(['key1', 'key2'])
     * console.log(data)
     * 
     * @param {array} keys - ID list
     * @param {ModelGetOptions} options
     * 
     * @returns {array}
     */
    mget(keys, {
        event = false,
        includeAllFields = false
    } = {}) {
        const result = { success: [], failure: [] }
        if (Array.isArray(keys) && keys.length > 0) {
            for (const key of keys) {
                const item = this.get(key, { event, includeAllFields })
                if (item) {
                    result.success.push({ id: key, ...item })
                } else {
                    result.failure.push(key)
                }
            }
        }
        return result
    }

    /**
     * Create of update an object with specific key
     * @example
     * const model = new Model()
     * model.on('error', (func, err, { key, value, index } = {}) => console.log(func, key, err, value, index))
     * model.on('set', (key, value, index, old) => console.log(key, value, index, old))
     * model.set('key1', { name: 'Ben' }).then(data => {
     *   console.log('Data is saved', data)
     * }).catch(error => {
     *   console.error(error)
     * }) 
     * 
     * @param {string} key - ID of an object
     * @param {object} value - Data to be saved in the JSON file
     * @param {ModelSetOptions} options 
     */
    set(key, value = {}, {
        event = false,
        saveMeta = true,
        audit = true,
        who,
        indexes = {}
    } = {}) {
        return new Promise((resolve, reject) => {
            const logs = { func: 'set', params: { key, event, saveMeta, audit, who, indexes }}
            try {
                if (!this.#keyValidator(key)) throw Error(`Invalid Key ${key}`)
                const exist = this.get(key, { event, includeAllFields: true }) || {}
                const data = {
                    _createdBy_: who,
                    createdAt: Date.now(),
                    ...exist,
                    ...value,
                    _updatedBy_: who,
                    updatedAt: Date.now()
                }
                const validator = new ValidateSchema(this.#rules)
                validator.validate(data).then(() => {
                    const isnew = !this.has(key, { event })
                    const file = isnew && this.#genFilePath() || this.getFilePath(key, { event })
                    if (!isnew && audit && this.#audit) {
                        const { __audit__ = [], createdAt, updatedAt, ...rest } = exist
                        const diff = objectDiff(rest, value, this.#audit)
                        if (diff.k.length > 0 || Array.isArray(__audit__) && __audit__.length) {
                            const auditFile = `${file}.audit`
                            const audit = readJsonSync(auditFile, this.#encrypt) || { __audit__ }
                            audit.__audit__.push({ u: who, d: data.updatedAt, ...diff })
                            outputJsonSync(auditFile, audit, this.#encrypt)
                        }
                        outputJsonSync(file, { ...data, __audit__: Array.isArray(__audit__) && __audit__.length && [] || undefined }, this.#encrypt)
                    } else {
                        outputJsonSync(file, data, this.#encrypt)
                    }
                    this.logger.silly(`Saved file ${file} for ${key}`, { ...logs })
                    if (isnew) {
                        const map = file.slice(this.#folder.length + 1)
                        this.#map[key] = map.split(path.sep)
                        this.logger.silly(`Updated file mapping ${key}`, { ...logs, map })
                    }
                    const index = this.#genIndex(data, { indexes })
                    this.#meta.data[key] = index
                    if (isnew) this.#meta.total++
                    this.logger.silly(`Updated meta ${key}`, { ...logs })
                    if (saveMeta) this.saveMeta()
                    if (event) this.emit('set', key, data)
                    resolve(data)
                }).catch(({ errors, fields }) => {
                    this.logger.warn(`Failed to validate object ${key}`, { value, errors, fields })
                    const error = new Error(`Failed to validate object ${key}`)
                    error.errors = errors
                    error.fields = fields
                    if (event) this.emit('error', error, { method: 'set', key, value, errors, fields })
                    reject(error)
                })
            } catch(error) {
                this.logger.error('Error Occurred', { ...logs, error})
                if (event) this.emit('error', error, { method: 'set', key, value })
                reject(new Error(`Failed to set object ${key}: ${error && error.message}`))
            }
        })
    }

    /**
     * Get the first object which the comparator returns true
     * @example
     * const model = new Model()
     * const item = model.find(item => item.id === 'key1')
     * console.log(item)
     * 
     * @param {function} comparator
     * 
     * @returns {ModelFindReturns | null}
     */
    find(comparator = (obj) => { return false }, {
        includeAllFields = false
    } = {}) {
        let result = null
        const key = Object.keys(this.#meta.data).find(k => comparator(this.#meta.data[k]))
        if (key) {
            const file = this.getFilePath(key)
            const data = readJsonSync(file, this.#encrypt)
            result = { id: key, data: retrieveObject(data, { includeAllFields }), index: this.#meta.data[key] }
        }
        return result
    }

    /**
     * Get all objects which the comparator returns true
     * @example
     * const model = new Model()
     * const list = model.findAll(item => item.role === 'admin').map(({ id, data, index }) => {
     *   return { id, ...data, ...index }
     * })
     * console.log(list)
     * 
     * @param {function} comparator
     * @param {PaginateOptions} options
     * 
     * @returns {ModelFindReturns[]}
     */
    findAll(comparator = (obj) => { return true }, {
        offset = 0,
        limit = 0,
        includeAllFields = false
    } = {}) {
        offset = parseInt(offset) || 0
        limit = parseInt(limit) || 0
        let keys = this.keysOf(comparator)
        if (keys.length > offset) keys = keys.slice(offset, limit > 0 && (offset + limit) || undefined)
        const result = []
        for (const key of keys) {
            const file = this.getFilePath(key)
            const data = readJsonSync(file, this.#encrypt)
            result.push({ id: key, data: retrieveObject(data, { includeAllFields }), index: this.#meta.data[key] })
        }
        return result
    }

    async findAllPromise(comparator = (obj) => { return true }, {
        offset = 0,
        limit = 0,
        includeAllFields = false
    } = {}) {
        offset = parseInt(offset) || 0
        limit = parseInt(limit) || 0
        let keys = this.keysOf(comparator)
        if (keys.length > offset) keys = keys.slice(offset, limit > 0 && (offset + limit) || undefined)
        return Promise.all(keys.map(key => {
            return readJson(this.getFilePath(key), this.#encrypt).then(data => {
                return { id: key, data: retrieveObject(data, { includeAllFields }), index: this.#meta.data[key] }
            })
        }, this))
    }

    /**
     * Keys of item matches criteria
     * @example
     * const model = new Model()
     * const keys = model.keysOf(item => item.role === 'admin')
     * console.log(keys)
     * 
     * @param {function} comparator 
     * @returns {array}
     */
    keysOf(comparator = (obj) => { return true }) {
        return Object.keys(this.#meta.data).filter(key => comparator(this.#meta.data[key]))
    }

    /**
     * Count of item matches criteria
     * @example
     * const model = new Model()
     * const count = model.countOf(item => item.role === 'admin')
     * console.log(count)
     * 
     * @param {function} comparator 
     * @returns {number}
     */
    countOf(comparator = (obj) => { return true }) {
        let cnt = 0
        for (const index of Object.values(this.#meta.data || {})) {
            if (comparator(index)) cnt += 1
        }
        return cnt
    }

    /**
     * Bulk create or update objects
     * @example
     * const model = new Model()
     * model.mset([
     *   { id: 'item1', name: 'Peter' },
     *   { name: 'John' }
     * ]).then(list => {
     *   console.log('List of objects been saved', list)
     * }).catch(console.error)
     * 
     * @param {array | object} data 
     * @param {ModelSetOptions} options 
     */
    async mset(data, {
        event = false,
        who,
        indexes = {}
    } = {}) {
        const logs = { func: 'mset', params: { event, who, indexes }}
        try {
            let result = { success: [], failure: [] }
            let objects = []
            if (Array.isArray(data)) {
                objects = data.map(item => {
                    item.id = item.id || uid(8)
                    return item
                })
            } else if (typeof data === 'object' && data) {
                objects = Object.entries(data).map(([id, value]) => {
                    return { id, ...value }
                })
            }
            if (Array.isArray(objects) && objects.length) {
                result = await Promise.allSettled(objects.map(item => {
                    return this.set(item.id, item, { event, saveMeta: false, who, indexes: indexes[item.id] || {} })
                })).then(results => {
                    return results.reduce((acc, { status, value, reason } = {}, index) => {
                        const item = objects[index] || {}
                        if (/fulfilled/i.test(status) && value) {
                            acc.success.push({ ...item, ...value })
                        } else {
                            const error = reason || new Error('Save failure')
                            this.logger.warn(`Fail to save object ${item.id}`, { ...logs, error, value, item })
                            acc.failure.push({ id: item.id, reason: error, status, value: value || item })
                        }
                        return acc
                    }, result)
                })
                this.saveMeta()
            }
            return Promise.resolve(result)
        } catch(error) {
            this.logger.error('Error Occurred', { ...logs, data, error})
            if (event) this.emit('error', error, { method: 'mset', data })
            return Promise.reject(new Error(`Failed to save data in mset: ${error && error.message}`))
        }
    }

    /**
     * Delete object with specific key
     * @example
     * const model = new Model()
     * model.on('deleted', (key, data) => console.log('deleted', key, data))
     * model.on('error', (func, err, { key } = {}) => console.log(func, key, err))
     * model.del('key1').then(obj => {
     *   console.log('Object been deleted', obj)
     * }).catch(console.error)
     * 
     * @param {string} key - ID of an object
     * @param {ModelDelOptions} options 
     */
     del(key, {
        event = false,
        saveMeta = true,
        real = true
    } = {}) {
        const logs = { func: 'del', params: { key, event, saveMeta, real }}
        return new Promise((resolve, reject) => {
            try {
                let data
                if (this.has(key, { event })) {
                    const file = this.getFilePath(key, { event })
                    delete this.#map[key]
                    this.logger.silly(`Deleted mapping ${key}`, { ...logs })
                    this.#meta.total--
                    delete this.#meta.data[key]
                    this.logger.silly(`Deleted meta ${key}`, { ...logs })
                    if (saveMeta) this.saveMeta()
                    if (fs2.pathExistsSync(file)) {
                        data = readJsonSync(file, this.#encrypt)
                        if (real) {
                            fs2.removeSync(file)
                            this.logger.debug(`Deleted file ${file}`, { ...logs })
                        }
                    }
                }
                if (event) this.emit('deleted', key, data)
                resolve(data)
            } catch(error) {
                this.logger.error('Error Occurred', { ...logs, error})
                if (event) this.emit('error', error, { method: 'del', key })
                reject(new Error(`Failed to delete object ${key}: ${error && error.message}`))
            }
        })
    }

    /**
     * Delete all objects
     * @example
     * const model = new Model()
     * model.delAll()
     * 
     */
    delAll() {
        const logs = { func: 'delAll' }
        const now = Date.now()
        const newMapFile = `${this.#mapfile}.del${now}`
        const newMetaFile = `${this.#metafile}.del${now}`
        fs2.renameSync(this.#mapfile, newMapFile)
        this.logger.silly(`Moved mapping file ${this.#mapfile} to ${newMapFile}`, { ...logs })
        fs2.renameSync(this.#metafile, newMetaFile)
        this.logger.silly(`Moved meta file ${this.#mapfile} to ${newMapFile}`, { ...logs })
        this.#map = {}
        this.#meta = defaultMeta()
        this.logger.silly('Initialize meta and mapping', { ...logs })
        this.saveMeta()
    }

    /**
     * Rebuild index for all objects
     * @returns {Promise}
     */
    buildIndex() {
        const logs = { func: 'buildIndex' }
        const objects = this.findAll()
        this.logger.silly(`Retrieved ${objects.length} objects`, { ...logs })
        for (const { id, data, index } of objects) {
            this.#meta.data[id] = this.#genIndex(data)
        }
        this.logger.silly('Build index done', { ...logs })
        this.saveMeta()
        this.logger.silly('Saved meta', { ...logs })
    }
}

/**
 * @typedef {Object} ModelConstructorOptions
 * @property {string} [rules = {}] - Rules for the validators, refer to https://www.npmjs.com/package/async-validator
 * @property {string} [indexes = []] - Name of the fields to save value in meta for searching
 */

/**
 * @typedef {Object} ModelHasOptions
 * @property {boolean} [event = false] - Indicates whether 'missed' event is triggered if not found
 */

/**
 * @typedef {Object} ModelGetOptions
 * @property {boolean} [event = false] - Indicates whether event is triggered if not found
 * @property {boolean} [includeAllFields = false] - Indicates whether the hidden fields are included in return
 */

/**
 * @typedef {Object} ModelDelOptions
 * @property {boolean} [event = false] - Indicates whether event is triggered if not found
 * @property {boolean} [real = true] - Indicates whether the JSON file will be really removed, if false, JSON file won't be delete but just delete key in meta
 * @property {boolean} [saveMeta = true] - Indicates whether meta file will be updated immediate
 */

/**
 * @typedef {Object} ModelSetOptions
 * @property {boolean} [event = false] - Indicates whether event is triggered if not found
 * @property {boolean} [saveMeta = true] - Indicates whether meta file will be updated immediate
 * @property {string | undefined} [who = undefined] - For createdBy and updatedBy
 * @property {object} [indexes = {}] - Additional indexes to save in meta when saving the item
 */

/**
 * @typedef {Object} ModelFindReturns
 * @property {string} key - ID of the object
 * @property {object} data - The data saved in JSON file
 * @property {object} index - The data saved in meta
 */

/**
 * @typedef {Object} PaginateOptions
 * @property {int} [offset = 0] - The first {offset} matched items are ignored
 * @property {int} [limit = 0] - Page size, if it is 0 then no limit
 */

module.exports = Model
