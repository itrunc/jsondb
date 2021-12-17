const os = require('os')
const path = require('path')
const fs2 = require('fs-extra')
const { uid } = require('uid')
const { EventEmitter } = require('events')
const ValidateSchema = require('async-validator').default
const { name: packageName } = require('../package.json')
const logger = require('debug')(`${packageName}:model`)
const { keyValidate } = require('./helper')

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
    /**
     * Create a new model instance
     * @example
     * const model = new Model({
     *   folder: 'path/to/model'
     * })
     * 
     * @constructor
     * @param {ModelConstructorOptions} options
     */
    constructor(folder = DEFAULT_PATH, {
        rules = {},
        indexes = []
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
        const date = (new Date()).toISOString()
        const year = date.substring(0, 4)
        const month = date.substring(5, 7)
        const day = date.substring(8, 10)
        const folder = path.resolve(this.#folder, year, month, day)
        fs2.ensureDirSync(folder)
        return path.resolve(folder, `${uid(8)}.json`)
    }

    #getIndex(data) {
        let index = {}
        if (data && typeof data === 'object' && this.#indexes.length > 0) {
            index = this.#indexes.reduce((result, prop) => {
                result[prop] = data[prop]
                return result
            }, {})
        }
        return index
    }

    saveMeta() {
        const debug = logger.extend('saveMeta')
        this.#meta.version = Date.now()
        fs2.outputJsonSync(this.#metafile, this.#meta)
        debug('Saved meta', this.#metafile)
        fs2.outputJSONSync(this.#mapfile, this.#map)
        debug('Saved file mapping', this.#mapfile)
    }

    /**
     * Check existence of a model with specific key. 
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

    getMeta(key, {
        event = false
    } = {}) {
        if (this.has(key)) {
            return this.#meta.data[key]
        }
        return {}
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
     * Create of update an object with specific key
     * @example
     * const model = new Model()
     * model.on('error', (func, err, { key, value, index } = {}) => console.log(func, key, err, value, index))
     * model.on('set', (key, value, index, old) => console.log(key, value, index, old))
     * model.set('key1', { name: 'Ben' })
     * 
     * @param {string} key - ID of an object
     * @param {object} value - Data to be saved in the JSON file
     * @param {object | undefined} index - Data to be saved in meta
     * @param {ModelSetOptions} options 
     */
    set(key, value = {}, {
        event = false,
        saveMeta = true
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
                    fs2.outputJsonSync(file, data)
                    debug('Saved file', file, 'for', key)
                    if (isnew) {
                        const map = file.slice(this.#folder.length + 1)
                        this.#map[key] = map
                        debug('Updated file mapping', key, map)
                    }
                    const index = this.#getIndex(data)
                    this.#meta.data[key] = index
                    if (isnew) this.#meta.total++
                    debug('Updated meta', key)
                    if (saveMeta) this.saveMeta()
                    if (event) this.emit('set', key, data)
                    resolve(data)
                }).catch(({ errors, fields }) => {
                    debug('Failed to validate object', key, value, errors, fields)
                    const error = new Error(`Failed to validate object ${key}`)
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
     * const data = model.find(item => item.id === 'key1')
     * console.log(data)
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
     * const data = model.findAll(item => item.role === 'admin')
     * console.log(data)
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
     * Bulk create or update objects
     * @example
     * const model = new Model()
     * model.mset({
     *   'key1': {
     *     value: { id: 'key1' }
     *   },
     *   'key2': {
     *     value: { id: 'key2', name: 'Ben', role: 'admin' }
     *     index: { role: 'admin' }
     *   }
     * })
     * 
     * @param {object} data 
     * @param {ModelSetOptions} options 
     */
    mset(data, {
        event = false
    } = {}) {
        return new Promise(async(resolve, reject) => {
            const debug = logger.extend('mset')
            try {
                const result = { success: [], failure: [] }
                if (data && Array.isArray(data) && data.length > 0) {
                    for (const { id = uid(8), ...value } of data) {
                        await this.set(id, value, { event, saveMeta: false }).then(data => {
                            result.success.push({ id, ...data })
                        }).catch(error => {
                            debug(`Error Occurred on saving ${id}`, error, value)
                            result.failure.push({ id, ...value })
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
     * model.del('key1')
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
                    const file = this.#map[key]
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
     * @param {ModelDelOptions} options 
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
 * @property {string} [folder = '~/.data'] - Path of a folder in which data will be saved
 */

/**
 * @typedef {Object} ModelHasOptions
 * @property {boolean} [event = true] - Indicates whether 'missed' event is triggered if not found
 */

/**
 * @typedef {Object} ModelGetOptions
 * @property {boolean} [event = true] - Indicates whether event is triggered if not found
 * @property {boolean} [housekeep = false] - Indicates whether the JSON file will be removed when key not found but the data file exists
 */

/**
 * @typedef {Object} ModelDelOptions
 * @property {boolean} [event = true] - Indicates whether event is triggered if not found
 * @property {boolean} [real = true] - Indicates whether the JSON file will be really removed, if false, JSON file won't be delete but just delete key in meta
 */

/**
 * @typedef {Object} ModelSetOptions
 * @property {boolean} [event = true] - Indicates whether event is triggered if not found
 * @property {boolean} [override = true] - Indicates whether content of the JSON file will be overrided by the value in parameters
 * @property {boolean} [saveMeta = true] - Indicates whether meta file will be updated immediate
 */

/**
 * @typedef {Object} ModelFindReturns
 * @property {string} key - ID of the object
 * @property {object} data - The data saved in JSON file
 * @property {object} options - The data saved in meta
 */

/**
 * @typedef {Object} PaginateOptions
 * @property {int} [offset = 0] - The first {offset} matched items are ignored
 * @property {int} [limit = 0] - Page size, if it is 0 then no limit
 */

module.exports = Model
