const path = require('path')
const fs2 = require('fs-extra')
const { expect } = require('chai')
const Mock = require('mockjs')
const { Schema, Model } = require('../index')
const { instance } = require('./utils')

const DATAPATH = path.resolve(__dirname, '.data', instance)
fs2.ensureDir(DATAPATH)

describe('Schema', function() {
    this.timeout(0)
    const folder = path.resolve(DATAPATH, 'schema')
    const schema = new Schema(folder)

    describe('#constructor', () => {
        it(`should create an instance of schema as well as the folder ${folder}`, () => {
            expect(schema).to.be.an.instanceOf(Schema)
            const folderCreated = fs2.pathExistsSync(folder)
            const modelFolderCreated = fs2.pathExistsSync(path.resolve(folder, '.model'))
            const schemaFolderCreated = fs2.pathExistsSync(path.resolve(folder, '.schema'))
            // const metaCreated = fs2.pathExistsSync(path.resolve(folder, '_s_.json'))
            expect(folderCreated).to.be.true
            expect(modelFolderCreated).to.be.true
            expect(schemaFolderCreated).to.be.true
            // expect(metaCreated).to.be.true
        })

        // it(`should create meta file correctly`, () => {
        //     const meta = fs2.pathExistsSync(schema.metaFile) && fs2.readJsonSync(schema.metaFile)
        //     expect(meta).to.be.an('object').that.to.have.all.keys(['models', 'schemas'])
        //     expect(meta.models).to.be.an('object').that.to.have.all.keys(['total', 'data'])
        //     expect(meta.schemas).to.be.an('object').that.to.have.all.keys(['total', 'data'])
        // })
    })

    describe('#schema', () => {
        const name = Mock.mock('@word(10)')
        const sub = schema.schema(name)
        it(`should create sub schema as well as the folder`, () => {
            expect(sub).to.be.an.instanceOf(Schema)
            const folderCreated = fs2.pathExistsSync(path.resolve(folder, '.schema', name))
            // const metaCreated = fs2.pathExistsSync(sub.metaFile)
            expect(folderCreated).to.be.true
            // expect(metaCreated).to.be.true
        })

        it(`should return count of sub schemas`, () => {
            schema.schema(Mock.mock('@word(10)'))
            expect(schema.schemaCount).to.be.a('number').that.to.equal(2)
            
            schema.schema(name) // No new schema created
            expect(schema.schemaCount).to.be.a('number').that.to.equal(2)
        })
        
        it(`should return true if sub schema exists`, () => {
            const hasSchema = schema.hasSchema(name)
            expect(hasSchema).to.be.true
        })

        it(`should return false if sub schema not existed`, () => {
            const hasSchema = schema.hasSchema('ttt')
            expect(hasSchema).to.be.false
        })

        it(`should return meta of sub schema`, () => {
            const meta = schema.getSchemaMeta(name)
            expect(meta).to.be.an('object').that.to.have.all.keys(['folder'])
            expect(meta.folder).to.equal(path.resolve(folder, '.schema', name))
        })

        it(`should remove both folder and meta of specific sub schema`, () => {
            schema.removeSchema(name)
            expect(schema.schemaCount).to.be.a('number').that.to.equal(1)
            const folderExist = fs2.pathExistsSync(path.resolve(folder, '.schema', name))
            const metaExist = fs2.pathExistsSync(path.resolve(folder, '.schema', name, '_s_.json'))
            expect(folderExist).to.be.false
            expect(metaExist).to.be.false
        })
    })

    describe('#model', () => {
        const name = Mock.mock('@word(10)')
        const sub = schema.model(name)
        it(`should create sub model as well as the folder`, () => {
            expect(sub).to.be.an.instanceOf(Model)
            const folderCreated = fs2.pathExistsSync(path.resolve(folder, '.model', name))
            const metaCreated = fs2.pathExistsSync(path.resolve(folder, '.model', name, '_m_.json'))
            expect(folderCreated).to.be.true
            expect(metaCreated).to.be.true
        })

        it(`should return count of sub models`, () => {
            schema.model(Mock.mock('@word(10)'))
            expect(schema.modelCount).to.be.a('number').that.to.equal(2)

            schema.model(name)
            expect(schema.modelCount).to.be.a('number').that.to.equal(2)
        })
        
        it(`should return true if sub model exists`, () => {
            const has = schema.hasModel(name)
            expect(has).to.be.true
        })

        it(`should return false if sub model not existed`, () => {
            const has = schema.hasModel('ttt')
            expect(has).to.be.false
        })

        it(`should return meta of sub model`, () => {
            const meta = schema.getModelMeta(name)
            expect(meta).to.be.an('object').that.to.have.all.keys(['folder'])
            expect(meta.folder).to.equal(path.resolve(folder, '.model', name))
        })

        it(`should remove both folder and meta of specific sub model`, () => {
            schema.removeModel(name)
            expect(schema.modelCount).to.be.a('number').that.to.equal(1)
            const folderExist = fs2.pathExistsSync(path.resolve(folder, '.model', name))
            const metaExist = fs2.pathExistsSync(path.resolve(folder, '.model', name, '_m_.json'))
            expect(folderExist).to.be.false
            expect(metaExist).to.be.false
        })
    })
})