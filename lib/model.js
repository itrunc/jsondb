const os = require('os')
const path = require('path')
const fs2 = require('fs-extra')
const { uid } = require('uid')
const { EventEmitter } = require('events')
const ValidateSchema = require('async-validator').default
const { name: packageName } = require('../package.json')
const logger = require('debug')(`${packageName}:model`)
const { keyValidate, objectDiff } = require('./helper')

const DEFAULT_PATH = path.resolve(os.homedir(), `.${packageName}-model`)

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
        audit = false
    } = {}) {
        super()
        const debug = logger.extend('constructor')

        this.#folder = path.resolve(folder, '.object')
        fs2.ensureDirSync(this.#folder)
        debug('Ensure folder created', this.#folder)

        this.#mapfile = path.resolve(folder, '_f_.json')
        this.#map = fs2.pathExistsSync(this.#mapfile) && fs2.readJsonSync(this.#mapfile) || {}

        this.#metafile = path.resolve(folder, '_m_.json')
        const default_meta = defaultMeta()
        if (fs2.pathExistsSync(this.#metafile)) {
            const data = fs2.readJsonSync(this.#metafile)
            this.#meta = { ...default_meta, ...data }
            this.#isnew = false
        } else {
            this.#meta = default_meta
            this.#isnew = true
            debug('Create new model')
        }
        this.saveMeta()

        this.#rules = rules || {}
        this.#indexes = indexes || []
        this.#audit = audit || false
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
        return keyValidate(key)
    }

    #genFilePath() {
        const date = new Date()
        const year = date.getFullYear()
        const month = date.getMonth()
        const day = date.getDate()
        const filename = `${uid(5)}.json`
        const folder = path.resolve(this.#folder, `${year}`, `${month}${day}`, filename[0])
        fs2.ensureDirSync(folder)
        return path.resolve(folder, filename.slice(1))
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
        const debug = logger.extend('saveMeta')
        this.#meta.version = Date.now()
        fs2.outputJsonSync(this.#metafile, this.#meta)
        debug('Saved meta', this.#metafile)
        fs2.outputJSONSync(this.#mapfile, this.#map)
        debug('Saved file mapping', this.#mapfile)
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
        const debug =  logger.extend('has')
        if (this.#keyValidator(key) && this.count > 0 && this.#meta.data[key] !== undefined && this.#map[key]) {
            return true
        }
        debug('Not found object', key)
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
        const debug = logger.extend('getFilePath')
        if (this.has(key, { event })) {
            const file = path.resolve(this.#folder, this.#map[key])
            debug(`File path of ${key} is`, file)
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
        event = false
    } = {}) {
        const debug = logger.extend('get')
        let data = null
        try {
            if (this.has(key, { event })) {
                const file = path.resolve(this.#folder, this.#map[key])
                if (fs2.pathExistsSync(file)) {
                    data = fs2.readJsonSync(file)
                } else {
                    debug(`File ${file} is not found`)
                }
            }
        } catch (error) {
            debug('Error Occurred', key, error)
            if (event) this.emit('error', error, { method: 'get', key })
        }
        return data
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
        event = false
    } = {}) {
        const result = { success: [], failure: [] }
        if (Array.isArray(keys) && keys.length > 0) {
            for (const key of keys) {
                const item = this.get(key, { event })
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
        indexes = {}
    } = {}) {
        return new Promise((resolve, reject) => {
            const debug = logger.extend('set')
            try {
                const exist = this.get(key, { event }) || {}
                const data = {
                    createdAt: Date.now(),
                    ...exist,
                    ...value,
                    updatedAt: Date.now()
                }
                const validator = new ValidateSchema(this.#rules)
                validator.validate(data).then(() => {
                    const isnew = !this.has(key, { event })
                    const file = isnew && this.#genFilePath() || path.resolve(this.#folder, this.#map[key])
                    if (!isnew && this.#audit) {
                        const { __audit__ = [], createdAt, updatedAt, ...rest } = exist
                        const diff = objectDiff(rest, value)
                        if (diff.k.length > 0) __audit__.push({ d: data.updatedAt, ...diff })
                        fs2.outputJsonSync(file, { ...data, __audit__ })
                    } else {
                        fs2.outputJsonSync(file, data)
                    }
                    debug('Saved file', file, 'for', key)
                    if (isnew) {
                        const map = file.slice(this.#folder.length + 1)
                        this.#map[key] = map
                        debug('Updated file mapping', key, map)
                    }
                    const index = this.#genIndex(data, { indexes })
                    this.#meta.data[key] = index
                    if (isnew) this.#meta.total++
                    debug('Updated meta', key)
                    if (saveMeta) this.saveMeta()
                    if (event) this.emit('set', key, data)
                    resolve(data)
                }).catch(({ errors, fields }) => {
                    debug('Failed to validate object', key, value, errors, fields)
                    const error = new Error(`Failed to validate object ${key}`)
                    error.errors = errors
                    error.fields = fields
                    if (event) this.emit('error', error, { method: 'set', key, value, errors, fields })
                    reject(error)
                })
            } catch(error) {
                debug('Error Occurred', key, error)
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
    find(comparator = (obj) => { return false }) {
        const debug = logger.extend('find')
        let result = null
        for (const [key, index = {}] of Object.entries(this.#meta.data || {})) {
            if (comparator(index)) {
                const file = this.#map[key] && path.resolve(this.#folder, this.#map[key])
                if (fs2.pathExistsSync(file)) {
                    const data = fs2.readJsonSync(file)
                    result = { id: key, data, index }
                    break
                } else {
                    debug(`File ${file} is not found for ${key}`)
                }
            }
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
        limit = 0
    } = {}) {
        const debug = logger.extend('findAll')
        offset = parseInt(offset) || 0
        limit = parseInt(limit) || 0
        const result = []
        let match = 0
        let selected = 0
        for (const [key, index = {}] of Object.entries(this.#meta.data || {})) {
            if (comparator(index)) {
                const file = this.#map[key] && path.resolve(this.#folder, this.#map[key])
                match += 1
                if (match > offset) {
                    if (fs2.pathExistsSync(file)) {
                        const data = fs2.readJsonSync(file)
                        result.push({ id: key, data, index })
                        selected += 1
                        if (limit > 0 && selected === limit) break
                    } else {
                        debug(`File ${file} is not found and retrieved for ${key}`)
                    }
                } else {
                    debug(`Skipped ${key}`)
                }
            }
        }
        return result
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
        const keys = []
        for (const [key, index = {}] of Object.entries(this.#meta.data || {})) {
            if (comparator(index)) keys.push(key)
        }
        return keys
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
    mset(data, {
        event = false,
        indexes = {}
    } = {}) {
        return new Promise(async(resolve, reject) => {
            const debug = logger.extend('mset')
            try {
                const result = { success: [], failure: [] }
                data = Array.isArray(data) && data || typeof data === 'object' && Object.entries(data).map(([id, value]) => {
                    return { id, ...value }
                }) || []
                if (data && Array.isArray(data) && data.length > 0) {
                    for (const { id = uid(8), ...value } of data) {
                        await this.set(id, value, { event, saveMeta: false, indexes: indexes[id] || {} }).then(data => {
                            result.success.push({ id, ...data })
                        }).catch(error => {
                            debug(`Error Occurred on saving ${id}`, error, value)
                            result.failure.push({ id, ...value, error })
                        })
                    }
                    this.saveMeta()
                }
                resolve(result)
            } catch(error) {
                debug('Error Occurred', error, data)
                if (event) this.emit('error', error, { method: 'mset', data })
                reject(new Error(`Failed to save data in mset: ${error && error.message}`))
            }
        })
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
        return new Promise((resolve, reject) => {
            const debug = logger.extend('del')
            try {
                let data
                if (this.has(key, { event })) {
                    const file = this.getFilePath(key, { event })
                    delete this.#map[key]
                    debug('Deleted mapping', key)
                    this.#meta.total--
                    delete this.#meta.data[key]
                    debug('Deleted meta', key)
                    if (saveMeta) this.saveMeta()
                    if (fs2.pathExistsSync(file)) {
                        data = fs2.readJsonSync(file)
                        if (real) {
                            fs2.removeSync(file)
                            debug('Deleted file', file)
                        }
                    }
                }
                if (event) this.emit('deleted', key, data)
                resolve(data)
            } catch(error) {
                debug('Error Occurred', key, error)
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
        const debug = logger.extend('delAll')
        const now = Date.now()
        const newMapFile = `${this.#mapfile}.del${now}`
        const newMetaFile = `${this.#metafile}.del${now}`
        fs2.renameSync(this.#mapfile, newMapFile)
        debug('Moved mapping file', this.#mapfile, newMapFile)
        fs2.renameSync(this.#metafile, newMetaFile)
        debug('Moved meta file', this.#metafile, newMetaFile)
        this.#map = {}
        this.#meta = defaultMeta()
        debug('Initialize meta and mapping')
        this.saveMeta()
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
