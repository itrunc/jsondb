const path = require('path')
const fs2 = require('fs-extra')
const { expect } = require('chai')
const Mock = require('mockjs')
const { Model } = require('../index')
const { instance } = require('./utils')
const { keyValidate } = require('../lib/helper')

const DATAPATH = path.resolve(__dirname, '.data', instance)
fs2.ensureDir(DATAPATH)

describe('Model', function() {
    this.timeout(0)
    const folder = path.resolve(DATAPATH, 'model')
    // const model = new Model({
    //   folder,
    //   rules: {
    //     name: [{ type: 'string', required: true, message: 'name is required' }],
    //     // test: [{ type: 'string', required: true, message: 'test is required' }],
    //     // test2: [{ type: 'string', required: true, message: 'test2 is required' }]
    //   }
    // })
    const key = Mock.mock('@word(10)')
    
    it('should validate key correctly', () => {
      expect(keyValidate(key)).to.be.true
    })

    // describe('#set', () => {
    //     it('should create JSON file correctly', (done) => {
    //         model.set(key, Mock.mock({
    //             id: key,
    //             name: '@first @last',
    //             role: '@pick(["Developer", "Admin"])'
    //         }), undefined, {
    //           promise: true
    //         }).then(result => {
    //           // console.log(result)
    //           expect(model.meta.data[key]).to.be.an('object').that.not.to.be.null
    //           const filePath = path.resolve(model.folder, `${key.toLowerCase().trim()}.json`)
    //           const fileCreated = fs2.pathExistsSync(filePath)
    //           expect(fileCreated).to.be.true
    //           const data = fs2.readJsonSync(filePath)
    //           expect(data).to.be.an('object').that.to.have.all.keys(['id', 'name', 'role', 'createdAt', 'updatedAt'])
    //           expect(data.id).to.equal(key)
    //           done()
    //         }).catch(done)
    //     })
    // })
})