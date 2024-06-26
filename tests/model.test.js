const path = require('path')
const fs2 = require('fs-extra')
const { expect } = require('chai')
const Mock = require('mockjs')
const { Model } = require('../index')
const { readJsonSync } = require('../lib/helper')
const { instance } = require('./utils')

const DATAPATH = path.resolve(__dirname, '.data', instance)
fs2.ensureDir(DATAPATH)

const PASSWORD = '123456'
const ITEM_COUNT = 10000

describe('Model', function() {
    this.timeout(0)
    const folder = path.resolve(DATAPATH, 'model')
    const model = new Model(folder, {
        rules: {
            name: [{ required: true }]
        },
        indexes: ['role'],
        audit: true,
        encrypt: PASSWORD
    })
    const key = Mock.mock('@word(10)')
    const mockObject = {
        'fail|10': [{
            id: '@word(8)',
            role: '@pick(["Developer", "Admin"])'
        }]
    }
    mockObject[`items|${ITEM_COUNT}`] = [{
        id: '@word(8)',
        name: '@first @last',
        role: '@pick(["Developer", "Admin"])'
    }]
    const data = Mock.mock(mockObject)

    describe('#constructor', () => {
        it(`should create an instance of model as well as the folder ${folder}`, () => {
            expect(model).to.be.an.instanceOf(Model)
            const folderCreated = fs2.pathExistsSync(path.resolve(folder, '.object'))
            // const metaCreated = fs2.pathExistsSync(path.resolve(folder, '_m_.json'))
            // const mapCreated = fs2.pathExistsSync(path.resolve(folder, '_f_.json'))
            expect(folderCreated).to.be.true
            // expect(metaCreated).to.be.true
            // expect(mapCreated).to.be.true
        })

        it(`should create meta file correctly`, () => {
            const meta = model.meta
            expect(meta).to.be.an('object').that.to.have.all.keys(['total', 'data', 'version'])
            expect(meta.version).to.be.a('number')
            expect(meta.total).to.be.a('number')
            expect(meta.data).to.be.an('object')
        })
    })

    describe('#set', () => {
        it(`should create JSON file correctly for ${key}`, (done) => {
            model.set(key, Mock.mock({
                name: '@first @last',
                role: '@pick(["Developer", "Admin"])'
            })).then(data => {
                expect(data).to.be.an('object').that.to.include.all.keys(['name', 'role', 'createdAt', 'updatedAt'])
                // expect(data.id).to.equal(key)
                expect(model.meta.data[key]).to.be.an('object').that.not.to.be.null
                const filePath = model.getFilePath(key)
                const fileCreated = fs2.pathExistsSync(filePath)
                expect(fileCreated).to.be.true
                data = readJsonSync(filePath, PASSWORD)
                expect(data).to.be.an('object').that.to.include.all.keys(['name', 'role', 'createdAt', 'updatedAt'])
                // expect(data.id).to.equal(key)
                done()
            }).catch(done)
        })

        it(`should update JSON file correctly for ${key}`, (done) => {
            const filePath = model.getFilePath(key)
            const before = readJsonSync(filePath, PASSWORD)
            model.set(key, {
                age: 10
            }, { indexes: { birth: '2011-01-01' }, who: 'me' }).then(data => {
                expect(data).to.be.an('object').that.to.include.all.keys(['name', 'role', 'createdAt', 'updatedAt', 'age'])
                data = readJsonSync(filePath, PASSWORD)
                expect(data).to.be.an('object').that.to.include.all.keys(['name', 'role', 'createdAt', 'updatedAt', 'age'])
                // expect(data.id).to.equal(key)
                expect(data.age).to.be.a('number').that.to.equal(10)
                expect(data.name).to.equal(before.name)
                expect(data.role).to.equal(before.role)
                expect(data.createdAt).to.equal(before.createdAt)
                expect(data.updatedAt).to.be.above(before.updatedAt)
                const meta = model.getMeta(key)
                expect(meta).to.be.an('object').that.to.include.all.keys(['role', 'birth'])
                done()
            }).catch(done)
        })

        // it(`should update audit correctly for ${key}`, (done) => {
        //     const filePath = model.getFilePath(key)
        //     model.set(key, {
        //         age: 11
        //     }).then(data => {
        //         data = readJsonSync(filePath, PASSWORD)
        //         expect(data).to.be.an('object').that.to.include.all.keys(['name', 'role', 'createdAt', 'updatedAt', 'age', '__audit__'])
        //         expect(data.__audit__).to.be.an('array').that.to.have.lengthOf(2)
        //         done()
        //     }).catch(done)
        // })
    })

    describe('#mset', () => {
        it('should bulk set data correctly', (done) => {
            model.mset(data.items.concat(data.fail)).then(result => {
                expect(result).to.be.an('object').that.to.have.all.keys(['success', 'failure'])
                expect(result.success).to.be.an('array').that.to.have.lengthOf(ITEM_COUNT)
                expect(result.failure).to.be.an('array').that.has.lengthOf(10).to.satisfy(objects => objects.every(item => item.id && item.reason))
                expect(model.count).to.be.an('number').that.to.be.gt(ITEM_COUNT)
                done()
            }).catch(done)
        })
    })

    describe('#count', () => {
        it('should return count of objects correctly', () => {
            expect(model.count).to.be.a('number')
        })
    })

    describe('#keys', () => {
        it('should return keys correctly', () => {
            expect(model.keys).to.be.an('array')
        })
    })

    describe('#has', () => {
        it('should return true if object exists', () => {
            const exists = model.has(key)
            expect(exists).to.be.true
        })
        it('should return false if object non-exist', () => {
            const exists = model.has('ttt')
            expect(exists).to.be.false
        })
    })

    describe('#get', async() => {
        // const key = Mock.mock('@word(10)')
        // const savedData = Mock.mock({
        //     name: '@first @last',
        //     role: '@pick(["Developer", "Admin"])'
        // })
        // await model.set(key, savedData).catch()
        it('should get data from JSON file correctly if existed', () => {
            const data = model.get(key)
            expect(data).to.be.an('object').that.to.have.any.keys(['name', 'role', 'createdAt', 'updatedAt'])
            expect(data).to.be.an('object').that.not.to.have.any.keys(['_createdBy_', '_updatedBy_'])
            // expect(data.name).to.equal(savedData.name)
            // expect(data.role).to.equal(savedData.role)
            const data2 = model.get(key, { includeAllFields: true })
            expect(data2).to.be.an('object').that.to.have.any.keys(['_createdBy_', '_updatedBy_'])
        })
        it('should return null if not existed', () => {
            const data = model.get('ttt')
            expect(data).to.be.null
        })
    })

    describe('#mget', () => {
        const keys = ['test'].concat([data.items[0].id]).concat([data.fail[0].id])
        it('should list of objects correctly', () => {
            const result = model.mget(keys)
            expect(result).to.be.an('object').that.to.have.all.keys(['success', 'failure'])
            expect(result.success).to.be.an('array').that.to.have.lengthOf(1)
            expect(result.success[0]).to.be.an('object').that.to.have.any.keys(['id'])
            expect(result.success[0].id).to.be.equal(data.items[0].id)
            expect(result.failure).to.be.an('array').that.to.have.members(['test', data.fail[0].id])
        })
    })

    describe('#find', () => {
        it('should return data if found', () => {
            const data = model.find(item => /admin/i.test(item.role))
            expect(data).to.be.an('object').that.to.have.all.keys(['id', 'data', 'index'])
        })
        it('should return null if not found', () => {
            const data = model.find(item => item.id === 'ttt')
            expect(data).to.be.null
        })
    })

    describe('#findAll', () => {
        it('should return all objects correctly', () => {
            const result = model.findAll()
            expect(result).to.be.an('array').that.to.have.lengthOf(model.count)
        })
        it('should return items with correct data format', () => {
            const result = model.findAll(item => /admin/i.test(item.role), { limit: 3 })
            expect(result).to.be.an('array').that.to.have.lengthOf(3)
            expect(result[0]).to.be.an('object').that.to.have.all.keys(['id', 'data', 'index'])
        })
        it('should returm empty array if not found', () => {
            const result = model.findAll(item => item.id === 'ttt')
            expect(result).to.be.an('array').that.to.be.empty
        })
    })

    describe('#countOf', () => {
        it('should return count of items with role as admin', () => {
            const total = model.countOf()
            expect(total).to.be.an('number').that.to.be.equal(model.count)
            const count = model.countOf(item => /admin/i.test(item.role))
            expect(count).to.be.an('number').that.to.be.lt(model.count)
        })
    })

    describe('#keysOf', () => {
        it('should return keys of items with role as admin', () => {
            const keys = model.keysOf(item => /admin/i.test(item.role))
            const count = model.countOf(item => /admin/i.test(item.role))
            expect(keys).to.be.an('array').that.to.have.lengthOf(count)
        })
    })

    describe('#del', () => {
        it('should delete JSON file correctly', (done) => {
            const key = data.items[100].id
            const exists = model.has(key)
            expect(exists).to.be.true
            const count = model.count
            const filePath = model.getFilePath(key)
            const fileExists = fs2.pathExistsSync(filePath)
            expect(fileExists).to.be.true
            model.del(key).then(item => {
                expect(item).to.be.an('object').that.to.include.all.keys(['name', 'role', 'createdAt', 'updatedAt'])
                const exists = model.has(key)
                expect(exists).to.be.false
                expect(model.count).to.be.equal(count - 1)
                const fileExists = fs2.pathExistsSync(filePath)
                expect(fileExists).to.be.false
                done()
            }).catch(done)
        })
    })

    describe('#buildIndex', () => {
        it('should build index correctly', () => {
            const model = new Model(folder, {
                indexes: ['role', 'name'],
                encrypt: PASSWORD
            })
            const count = model.count
            model.buildIndex()
            expect(model.countOf(i => i.name)).equal(count)
        })
    })
})