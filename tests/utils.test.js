const path = require('path')
const fs2 = require('fs-extra')
const { expect } = require('chai')
const Mock = require('mockjs')
const { JsondbUtils, Schema, Model } = require('../index')
const { instance } = require('./utils')

const DATAPATH = path.resolve(__dirname, '.data', instance)
fs2.ensureDir(DATAPATH)

describe('JsondbUtils', function() {
  this.timeout(0)
  const folder = path.resolve(DATAPATH, 'utils')
  const store = new Schema(folder)
  const schemas = {
    temp: {},
    account: {
      roles: {
        name: 'account_roles',
        rules: {
          name: [{ type: 'string', required: true, message: 'name is required' }]
        },
        audit: true,
        linked: { 'users': 'role' }
      },
      users: {
        name: 'account_users',
        indexes: ['role'],
        rules: {
          name: [{ type: 'string', required: true, message: 'name is required' }],
          role: [{ type: 'string', required: true, message: 'role is required' }]
        }
      }
    }
  }
  const accountSchema = new JsondbUtils(store, 'jsondb', 'account', { schemas })
  const tempSchema = new JsondbUtils(store, 'jsondb', 'temp', { schemas })
  const role = {
    id: 'admin',
    name: 'Super Admin'
  }
  const users = [
    { id: 'ben', name: 'Ben PAN', role: 'admin', desc: 'Ben is a good guy' },
    { name: 'John', role: 'developer', desc: 'John is a good developer' },
    { name: 'Justin', role: 'manager' },
    { name: 'Bob' },
    { id: 'nonexist', name: 'User to be deleted', role: 'user' },
    { id: 'nonexist2', name: 'User to be deleted', role: 'user' }
  ]

  describe('#checkModelExistence', () => {
    it(`Any model name exists in temp schema`, () => {
      expect(tempSchema.checkModelExistence(`AnyModelName_${Date.now()}`)).to.be.true
    })

    it(`should check model existence as expected`, () => {
      expect(accountSchema.checkModelExistence('users')).to.be.true
      expect(accountSchema.checkModelExistence('account_roles')).to.be.false
    })
  })

  describe('#getModel', () => {
    it(`should get model as expected`, () => {
      expect(accountSchema.getModel('users')).to.be.an.instanceOf(Model)
    })
  })

  describe('#createObject', () => {

    it(`should create object as expected`, (done) => {
      accountSchema.createObject('roles', role).then(item => {
        expect(item).to.be.an('object').that.includes.all.keys(['id', 'name'])
        expect(item.id).to.equal(role.id)
        expect(item.name).to.equal(role.name)
        done()
      }).catch(done)
    })

    it('should not create object if object existed', (done) => {
      accountSchema.createObject('roles', role).then(item => {
        done(new Error('object existed, should not create the object with exiting id'))
      }).catch(error => {
        done()
      })
    })

    it('should update existing object if override is true', (done) => {
      const desc = 'Super admin has all permissions'
      accountSchema.createObject('roles', { ...role, desc }, { override: true }).then(item => {
        expect(item).to.be.an('object').that.includes.all.keys(['id', 'name', 'desc'])
        expect(item.id).to.equal(role.id)
        expect(item.name).to.equal(role.name)
        expect(item.desc).to.equal(desc)
        const model = accountSchema.getModel('roles')
        expect(model.count).to.equal(1)
        done()
      }).catch(done)
    })
  })

  describe('#updateObject', () => {
    it('should update object as expected', (done) => {
      const desc = 'Super admin has all permissions!'
      accountSchema.updateObject('roles', role.id, { desc }).then(item => {
        expect(item).to.be.an('object').that.includes.all.keys(['id', 'name', 'desc'])
        expect(item.id).to.equal(role.id)
        expect(item.name).to.equal(role.name)
        expect(item.desc).to.equal(desc)
        const model = accountSchema.getModel('roles')
        expect(model.count).to.equal(1)
        done()
      }).catch(done)
    })

    it('should not update non-exist object', (done) => {
      accountSchema.updateObject('roles', `nonexist_${Date.now()}`, { name: 'Non Exist Object' }).then(item => {
        done(new Error('object does not exist, should thrown error'))
      }).catch(error => {
        done()
      })
    })

    it('should create the non-exist object if create is true', (done) => {
      const objectId = `nonexist_${Date.now()}`
      const data = { id: 'test', name: 'Non Exist Object' }
      accountSchema.updateObject('roles', objectId, data, { create: true }).then(item => {
        expect(item).to.be.an('object').that.includes.all.keys(['id', 'name'])
        expect(item.id).to.equal(objectId)
        expect(item.name).to.equal(data.name)
        const model = accountSchema.getModel('roles')
        expect(model.count).to.equal(2)
        done()
      }).catch(done)
    })
  })

  describe('#saveObjects', () => {
    it('should import objects as expected', (done) => {
      accountSchema.saveObjects('users', users).then(({ success, failure }) => {
        expect(success).to.be.an('array').that.has.lengthOf(users.length - 1)
        expect(failure).to.be.an('array').that.has.lengthOf(1)
        done()
      }).catch(done)
    })
  })

  describe('#checkObjectExistence', () => {
    it('should check object existence as expected', () => {
      expect(accountSchema.checkObjectExistence('users', 'ben')).to.be.true
      expect(accountSchema.checkObjectExistence('users', `nonexist_${Date.now()}`)).to.be.false
      const existAdmin = accountSchema.checkObjectExistence('users', (item) => item.role === 'admin')
      expect(existAdmin).to.be.true
      const existUnknownRole = accountSchema.checkObjectExistence('users', (item) => item.role === 'unknown')
      expect(existUnknownRole).to.be.false
    })
  })

  describe('#getObject', () => {
    it('should get object as expected', (done) => {
      const objectId = 'admin'
      accountSchema.getObject('roles', objectId).then(item => {
        expect(item).to.be.an('object').that.includes.all.keys(['id', 'name'])
        expect(item).not.have.any.keys(['__audit__'])
        expect(item.id).to.equal(objectId)
        done()
      }).catch(done)
    })

    it('should not get non-exist object', (done) => {
      const objectId = `nonexist_${Date.now()}`
      accountSchema.getObject('roles', objectId).then(item => {
        expect(item).to.be.null
        done()
      }).catch(done)
    })

    it('should get object with all fields', (done) => {
      const objectId = 'admin'
      accountSchema.getObject('roles', objectId, { includeAllFields: true }).then(item => {
        expect(item).to.be.an('object').that.includes.all.keys(['id', 'name', '__audit__'])
        expect(item.id).to.equal(objectId)
        done()
      }).catch(done)
    })
  })

  describe('#getObjectAudits', () => {
    it('should get audits of specific object as expected', (done) => {
      const objectId = 'admin'
      accountSchema.getObjectAudits('roles', objectId).then(audits => {
        expect(audits).to.be.an('array')
        done()
      }).catch(done)
    })
  })

  describe('#getObjects', () => {
    it('should get objects as expected', (done) => {
      const list = ['ben', `nonexist_${Date.now()}`]
      accountSchema.getObjects('users', list).then(data => {
        expect(data).to.be.an('object').that.to.include.all.keys(['success', 'failure'])
        expect(data.success).to.be.an('array').that.has.lengthOf(1).to.satisfy((objects) => objects.every(item => item.id === 'ben'))
        expect(data.failure).to.be.an('array').that.has.lengthOf(1).to.satisfy((objects) => objects.every(item => item.id && item.reason))
        done()
      }).catch(done)
    })
  })

  describe('#retrieveObjects', () => {
    it('should retrieve objects as expected', (done) => {
      const model = accountSchema.getModel('users')
      accountSchema.retrieveObjects('users').then(objects => {
        expect(objects).to.be.an('array').that.has.lengthOf(model.count)
        done()
      }).catch(done)
    })

    it('should retrieve objects with version as expected', (done) => {
      const model = accountSchema.getModel('users')
      accountSchema.retrieveObjects('users', { version: true }).then(data => {
        expect(data).to.be.an('object').that.has.all.keys(['version', 'objects'])
        expect(data.version).to.equal(model.version)
        expect(data.objects).to.be.an('array').that.has.lengthOf(model.count)
        done()
      }).catch(done)
    })

    it('should retrieve objects with criteria as expected', (done) => {
      accountSchema.retrieveObjects('users', {
        criteria: {
          role: 'admin' // role in index
        }
      }).then(objects => {
        expect(objects).to.be.an('array').that.has.lengthOf(1)
        done()
      }).catch(done)
    })

    it('should retrieve objects with criteria safe', (done) => {
      accountSchema.retrieveObjects('users', {
        criteria: {
          desc: { calc: 'like', value: 'good' } // desc not in index
        }
      }).then(objects => {
        expect(objects).to.be.an('array').that.has.lengthOf(2).to.satisfy((objects) => objects.every(item => item.id && /good/.test(item.desc)))
        done()
      }).catch(done)
    })

    it('should retrieve objects with criteria unsafe', (done) => {
      const model = accountSchema.getModel('users')
      accountSchema.retrieveObjects('users', {
        criteria: {
          desc: { calc: 'like', value: 'good' }, // desc not in index
        },
        safe: false
      }).then(objects => {
        expect(objects).to.be.an('array').that.has.lengthOf(model.count)
        done()
      }).catch(done)
    })
  })

  describe('#retrieveMetaData', () => {
    it('should retrieve meta of model as expected', (done) => {
      accountSchema.retrieveMetaData('users', {
        criteria: {
          role: ['developer', 'manager']
        }
      }).then(data => {
        expect(data).to.be.an('object').that.to.satisfy(d => {
          return Object.values(d).every(i => ['developer', 'manager'].includes(i.role))
        })
        done()
      }).catch(done)
    })
  })

  describe('#deleteObject', () => {
    it('should delete object as expected', (done) => {
      const model = accountSchema.getModel('users')
      const countBeforeDeleted = model.count
      const objectId = 'nonexist'
      accountSchema.deleteObject('users', objectId).then(item => {
        expect(item).to.be.an('object').that.includes.all.keys(['id', 'name', 'role'])
        expect(item.id).to.equal(objectId)
        expect(model.count).to.be.equal(countBeforeDeleted - 1)
        expect(model.has(objectId)).to.be.false
        done()
      }).catch(done)
    })

    it('should not delete object if it is linked', (done) => {
      const model = accountSchema.getModel('roles')
      const objectId = 'admin'
      accountSchema.deleteObject('roles', objectId).then(item => {
        done(new Error('should not delete the object'))
      }).catch(error => {
        expect(model.has(objectId)).to.be.true
        done()
      })
    })
  })

  describe('#deleteObjectsByID', () => {
    it('should delete objects by id list as expected', (done) => {
      const model = accountSchema.getModel('users')
      const countBeforeDeleted = model.count
      accountSchema.deleteObjectsByID('users', ['nonexist', 'nonexist2', 'nonexist3']).then(data => {
        expect(data).to.be.an('object').that.to.include.all.keys(['success', 'failure'])
        expect(data.success).to.be.an('array').that.has.lengthOf(1)
        expect(data.failure).to.be.an('array').that.has.lengthOf(2).to.satisfy(objects => objects.every(item => item.reason))
        expect(model.count).to.equal(countBeforeDeleted - data.success.length)
        done()
      }).catch(done)
    })
  })

  describe('#deleteObjectsWithCriteria', () => {
    it('should delete objects by id list as expected', (done) => {
      const model = accountSchema.getModel('users')
      const countBeforeDeleted = model.count
      accountSchema.deleteObjectsWithCriteria('users', {
        role: 'developer'
      }).then(data => {
        expect(data).to.be.an('object').that.to.include.all.keys(['success', 'failure'])
        expect(data.success).to.be.an('array').that.has.lengthOf(1)
        expect(data.failure).to.be.an('array').that.to.be.empty
        expect(model.count).to.equal(countBeforeDeleted - data.success.length)
        done()
      }).catch(done)
    })
  })
})