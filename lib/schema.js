const os = require('os')
const path = require('path')
const fs2 = require('fs-extra')
const { EventEmitter } = require('events')
const Model = require('./model')
const { createLogger } = require('./helper')
const logger = createLogger('schema')

const DEFAULT_PATH = path.resolve(os.homedir(), `.jsondb-schema`)

const defaultMeta = () => {
    return {
        models: {
            total: 0,
            data: {}
        },
        schemas: {
            total: 0,
            data: {}
        }
    }
}

/**
 * Create / Get a schema
 */
class Schema extends EventEmitter {
    #modelfolder
    #schemafolder
    #metafile
    #meta
    #isnew
    /**
     * Create a new schema instance
     * @example
     * const schema = new Schema('path/to/schema')
     * 
     * @constructor
     * @param {string} folder - path to save the schema
     */
    constructor(folder = DEFAULT_PATH) {
        super()
        const debug = logger.extend('constructor')
        this.#modelfolder = path.resolve(folder, '.model')
        fs2.ensureDirSync(this.#modelfolder)
        debug('Ensure folder created', this.#modelfolder)

        this.#schemafolder = path.resolve(folder, '.schema')
        fs2.ensureDirSync(this.#schemafolder)
        debug('Ensure folder created', this.#schemafolder)

        this.#metafile = path.resolve(folder, '_s_.json')
        const default_meta = defaultMeta()
        if (fs2.pathExistsSync(this.#metafile)) {
            const data = fs2.readJsonSync(this.#metafile)
            this.#meta = { ...default_meta, ...data }
            this.#isnew = false
        } else {
            this.#meta = default_meta
            this.#isnew = true
            debug('Create new schema')
        }
        this.saveMeta()
    }

    get isNew() {
        return this.#isnew
    }

    get meta() {
        return this.#meta
    }

    get schemaKeys() {
        return this.#meta.schemas && this.#meta.schemas.data && Object.keys(this.#meta.schemas.data) || []
    }

    get schemaCount() {
        return this.#meta.schemas && this.#meta.schemas.total || 0
    }

    get modelKeys() {
        return this.#meta.models && this.#meta.models.data && Object.keys(this.#meta.models.data) || []
    }

    get modelCount() {
        return this.#meta.models && this.#meta.models.total || 0
    }

    #nameValidator(name) {
        return /^[\w\-]+$/i.test(name)
    }

    #name(name) {
        return name.trim()
    }

    saveMeta() {
        const debug = logger.extend('saveMeta')
        fs2.outputJSONSync(this.#metafile, this.#meta)
        debug('Saved meta file', this.#metafile)
    }

    hasSchema(name, {
        event = false
    } = {}) {
        const debug = logger.extend('hasSchema')
        name = this.#name(name)
        if (this.#nameValidator(name) && this.#meta.schemas && this.#meta.schemas.data && this.#meta.schemas.data[name] !== undefined) {
            return true
        }
        debug('Not found schema', name)
        if (event) this.emit('missed', key, { type: 'schema' })
        return false
    }

    hasModel(name, {
        event = false
    } = {}) {
        const debug = logger.extend('hasModel')
        name = this.#name(name)
        if (this.#nameValidator(name) && this.#meta.models && this.#meta.models.data && this.#meta.models.data[name] !== undefined) {
            return true
        }
        debug('Not found model', name)
        if (event) this.emit('missed', key, { type: 'model' })
        return false
    }

    getSchemaMeta(name, {
        event = false
    } = {}) {
        let result = null
        if (this.hasSchema(name, { event })) {
            result = this.#meta.schemas.data[name]
        }
        return result
    }

    getModelMeta(name, {
        event = false
    } = {}) {
        let result = null
        if (this.hasModel(name, { event })) {
            result = this.#meta.models.data[name]
        }
        return result
    }

    removeSchema(name, {
        event = false
    } = {}) {
        const debug = logger.extend('removeSchema')
        try {
            name = this.#name(name)
            if (this.hasSchema(name, { event })) {
                const folder = path.resolve(this.#schemafolder, name)
                delete this.#meta.schemas.data[name]
                this.#meta.schemas.total--
                this.saveMeta()
                if (fs2.pathExistsSync(folder)) fs2.removeSync(folder)
                if (event) this.emit('deleted', name, { type: 'schema' })
            }
        } catch(error) {
            debug('Error Occurred', name, error)
            throw new Error(`Failed to remove sub schema ${name} due to ${error && error.message}`)
        }
    }

    removeModel(name, {
        event = false
    } = {}) {
        const debug = logger.extend('removeModel')
        try {
            name = this.#name(name)
            if (this.hasModel(name, { event })) {
                const folder = path.resolve(this.#modelfolder, name)
                delete this.#meta.models.data[name]
                this.#meta.models.total--
                this.saveMeta()
                if (fs2.pathExistsSync(folder)) fs2.removeSync(folder)
                if (event) this.emit('deleted', name, { type: 'model' })
            }
        } catch(error) {
            debug('Error Occurred', name, error)
            throw new Error(`Failed to remove sub model ${name} due to ${error && error.message}`)
        }
    }


    /**
     * Create or get an instance of sub model
     * @example
     * const schema = new Schema()
     * const model = schema.model('test')
     * 
     * @param {string} name - folder name of the sub model
     * @param {ModelConstructorOptions} options
     * @returns {Model}
     */
    model(name, {
        rules,
        indexes,
        audit
    } = {}) {
        const debug = logger.extend('model')
        try {
            name = this.#name(name)
            if (this.#nameValidator(name)) {
                const folder = path.resolve(this.#modelfolder, name)
                const instance = new Model(folder, { rules, indexes, audit })
                instance.on('error', (error, { method } = {}) => {
                    debug(`Error occurred on Model method: ${method}, message: ${error && error.message}`)
                })
                if (instance.isNew) {
                    this.#meta.models.data[name] = { folder }
                    this.#meta.models.total++
                }
                this.saveMeta()
                return instance
            } else {
                throw new Error(`Invalid Model Name`)
            }
        } catch (error) {
            debug('Error Occurred', name, error)
            throw new Error(`Failed to retrieve sub model ${name} due to ${error && error.message}`)
        }
    }

    /**
     * Create or get an instance of sub schema
     * @example
     * const schema = new Schema()
     * const sub = schema.schema('test')
     * 
     * @param {string} name - folder name of the sub schema
     * @returns {Schema}
     */
    schema(name) {
        const debug = logger.extend('schema')
        try {
            name = this.#name(name)
            if (this.#nameValidator(name)) {
                const folder = path.resolve(this.#schemafolder, name)
                const instance = new Schema(folder)
                instance.on('error', (error, { method } = {}) => {
                    debug(`Error occurred on Schema method: ${method}, message: ${error && error.message}`)
                })
                if (instance.isNew) {
                    this.#meta.schemas.data[name] = { folder }
                    this.#meta.schemas.total++
                }
                this.saveMeta()
                return instance
            } else {
                throw new Error(`Invalid Schema Name`)
            }
        } catch (error) {
            debug('Error Occurred', name, error)
            throw new Error(`Failed to retrieve sub schema ${name} due to ${error && error.message}`)
        }
    }
}

module.exports = Schema
