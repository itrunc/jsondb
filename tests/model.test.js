process.env.DEBUG = '*'
const path = require('path')
const fs2 = require('fs-extra')
const { expect } = require('chai')
const Mock = require('mockjs')
const { Model } = require('../index')
const { instance } = require('./utils')

const DATAPATH = path.resolve(__dirname, '.data', instance)
fs2.ensureDir(DATAPATH)

describe('Model', function() {
    this.timeout(0)
    const folder = path.resolve(DATAPATH, 'model')
    const model = new Model(folder, {
        rules: {
            name: [{ required: true }]
        },
        indexes: ['name']
    })
    const key = Mock.mock('@word(10)')

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
        it('should create JSON file correctly', (done) => {
            model.set(key, Mock.mock({
                name: '@first @last',
                role: '@pick(["Developer", "Admin"])'
            })).then(data => {
                expect(data).to.be.an('object').that.to.have.all.keys(['name', 'role', 'createdAt', 'updatedAt'])
                // expect(data.id).to.equal(key)
                expect(model.meta.data[key]).to.be.an('object').that.not.to.be.null
                const filePath = model.getFilePath(key)
                const fileCreated = fs2.pathExistsSync(filePath)
                expect(fileCreated).to.be.true
                data = fs2.readJsonSync(filePath)
                expect(data).to.be.an('object').that.to.have.all.keys(['name', 'role', 'createdAt', 'updatedAt'])
                // expect(data.id).to.equal(key)
                done()
            }).catch(done)
        })

        it('should update JSON file correctly', (done) => {
            const filePath = model.getFilePath(key)
            const before = fs2.readJsonSync(filePath)
            model.set(key, {
                age: 10
            }).then(data => {
                expect(data).to.be.an('object').that.to.have.all.keys(['name', 'role', 'createdAt', 'updatedAt', 'age'])
                data = fs2.readJsonSync(filePath)
                expect(data).to.be.an('object').that.to.have.all.keys(['name', 'role', 'createdAt', 'updatedAt', 'age'])
                // expect(data.id).to.equal(key)
                expect(data.age).to.be.a('number').that.to.equal(10)
                expect(data.name).to.equal(before.name)
                expect(data.role).to.equal(before.role)
                expect(data.createdAt).to.equal(before.createdAt)
                expect(data.updatedAt).to.be.above(before.updatedAt)
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
            // expect(data.name).to.equal(savedData.name)
            // expect(data.role).to.equal(savedData.role)
        })
        it('should return null if not existed', () => {
            const data = model.get('ttt')
            expect(data).to.be.null
        })
    })

    // describe('#del', () => {
    //     const key = Mock.mock('@word(10)')
    //     const savedData = Mock.mock({
    //         id: key,
    //         name: '@first @last',
    //         role: '@pick(["Developer", "Admin"])'
    //     })
    //     model.set(key, savedData)
    //     const filePath = path.resolve(model.folder, `${key.toLowerCase().trim()}.json`)
    //     it('should delete JSON file correctly', () => {
    //         const exists = model.has(key)
    //         expect(exists).to.be.true
    //         const before = model.get(key)
    //         expect(before).to.be.an('object').that.not.to.be.null
    //         const beforeCount = model.count()
    //         model.del(key)
    //         const afterCount = model.count()
    //         expect(afterCount).to.be.a('number').that.to.equal(beforeCount - 1)
    //         const afterExists = model.has(key)
    //         expect(afterExists).to.be.false
    //         const fileExists = fs2.pathExistsSync(filePath)
    //         expect(fileExists).to.be.false
    //     })
    // })

    // describe('#find', () => {
    //     it('should return data if found', () => {
    //         const data = model.find(item => item.id === key)
    //         expect(data).to.be.an('object').that.not.to.be.null
    //     })
    //     it('should return null if not found', () => {
    //         const data = model.find(item => item.id === 'ttt')
    //         expect(data).to.be.null
    //     })
    // })

    // describe('#mset', () => {
    //     const data = Mock.mock('@sentence(10)').split(' ').reduce((acc, cur) => {
    //         const id = Mock.mock('@word(10)')
    //         const role = Mock.mock('@pick(["Developer", "Admin"])')
    //         acc[id] = Mock.mock({
    //             value: {
    //                 id,
    //                 name: '@first @last',
    //                 role
    //             },
    //             index: {
    //                 role
    //             }
    //         })
    //         return acc
    //     }, {})
    //     it('should bulk set data correctly', () => {
    //         model.mset(data)
    //         const count = model.count()
    //         expect(count).to.be.above(Object.keys(data).length)
    //         for(const key of Object.keys(data)) {
    //             const item = model.get(key)
    //             expect(item).to.be.an('object').that.not.to.be.null
    //             expect(item.id).to.equal(data[key].value.id)
    //             expect(item.name).to.equal(data[key].value.name)
    //             expect(item.role).to.equal(data[key].value.role)
    //             const meta = model.meta.data[key]
    //             expect(meta).to.be.an('object').that.to.have.all.keys(['role'])
    //             expect(meta.role).to.equal(data[key].value.role)
    //         }
    //     })
    // })

    // describe('#findAll', () => {
    //     it('should return all objects correctly', () => {
    //         const result = model.findAll()
    //         expect(result).to.be.an('array').that.to.have.lengthOf(model.count())
    //     })
    //     it('should return items with correct data format', () => {
    //         const result = model.findAll(item => item.id === key)
    //         expect(result).to.be.an('array').that.to.have.lengthOf(1)
    //         expect(result[0]).to.be.an('object').that.to.have.all.keys(['id', 'data', 'options'])

    //         const result2 = model.findAll(item => item, { limit: 3 })
    //         expect(result2).to.be.an('array').that.to.have.lengthOf(3)
    //     })
    //     it('should returm empty array if not found', () => {
    //         const result = model.findAll(item => item.id === 'ttt')
    //         expect(result).to.be.an('array').that.to.be.empty
    //     })

    // })
})