const path = require('path')
const fs2 = require('fs-extra')
const { expect } = require('chai')
const Mock = require('mockjs')
const { instance } = require('./utils')
const { keyValidate, objectDiff } = require('../lib/helper')

const DATAPATH = path.resolve(__dirname, '.data', instance)
fs2.ensureDir(DATAPATH)

describe('Helper', function() {
  describe('#keyValidate', function() {
    const key = Mock.mock('@word(10)')
      
    it('should validate key correctly', () => {
      expect(keyValidate(key)).to.be.true
      expect(keyValidate('test<>')).to.be.false
    })
  })
  
  describe('#objectDiff', function() {
    const obj1 = { id: 1, name: 'Ben' }
    const obj2 = { id: 1, name: 'Ben' }
    it('should not return keys if two objects are same', () => {
      const result_1_2 = objectDiff(obj1, obj2)
      expect(result_1_2).to.be.an('object').that.to.have.all.keys(['k', 'b', 'a'])
      expect(result_1_2.k).to.be.an('array').that.to.be.empty
    })
  
    const obj3 = { id: 1, name: 'Bob' }
    const obj4 = { id: 1, name: 'Ben', age: 10 }
    it('should return exactly keys if two objects are different', () => {
      const result_2_3 = objectDiff(obj2, obj3)
      expect(result_2_3).to.be.an('object').that.to.have.all.keys(['k', 'b', 'a'])
      expect(result_2_3.k).to.be.an('array').that.to.have.lengthOf(1).that.to.include('name')
  
      const result_3_4 = objectDiff(obj3, obj4)
      expect(result_3_4).to.be.an('object').that.to.have.all.keys(['k', 'b', 'a'])
      expect(result_3_4.k).to.be.an('array').that.to.have.lengthOf(2).that.to.include('age')
  
      // const result_4_3 = objectDiff(obj4, obj3)
      // expect(result_4_3).to.be.an('object').that.to.have.all.keys(['k', 'b', 'a'])
      // expect(result_4_3.k).to.be.an('array').that.to.have.lengthOf(2).that.to.include('age')
    })
  
    const obj5 = { id: 1, name: 'Ben', age: 10, photo: { url: 'url1' } }
    const obj51 = { id: 1, name: 'Ben', age: 10, photo: { url: 'url1' } }
    const obj52 = { name: 'Ben', age: 10, photo: { url: 'url1' } }
    const obj6 = { id: 1, name: 'Ben', age: 10, photo: { url: 'url2' } }
    const obj61 = { name: 'Ben', age: 10, photo: { url: 'url2' } }
    const obj7 = { id: 1, name: 'Ben', age: 10, photo: { url: 'url2', size: 'small' } }
    const obj71 = { name: 'Ben', age: 10, photo: { url: 'url2', size: 'small' } }
    it('should return as expected if sub object included', () => {
      const result_4_5 = objectDiff(obj4, obj5)
      expect(result_4_5).to.be.an('object').that.to.have.all.keys(['k', 'b', 'a'])
      expect(result_4_5.k).to.be.an('array').that.to.have.lengthOf(1).that.to.include('photo')
  
      const result_5_51 = objectDiff(obj5, obj51)
      expect(result_5_51).to.be.an('object').that.to.have.all.keys(['k', 'b', 'a'])
      expect(result_5_51.k).to.be.an('array').that.to.be.empty
  
      const result_5_6 = objectDiff(obj52, obj61)
      expect(result_5_6).to.be.an('object').that.to.have.all.keys(['k', 'b', 'a'])
      expect(result_5_6.k).to.be.an('array').that.to.have.lengthOf(1).that.to.include('photo')
  
      const result_7_6 = objectDiff(obj71, obj61)
      expect(result_7_6).to.be.an('object').that.to.have.all.keys(['k', 'b', 'a'])
      expect(result_7_6.k).to.be.an('array').that.to.have.lengthOf(1).that.to.include('photo')
    })
  
    const obj8 = { id: 1, name: 'Ben', age: 10, photos: [{ url: 'url1' }] }
    const obj81 = { id: 1, name: 'Ben', age: 10, photos: [{ url: 'url1' }] }
    const obj82 = { id: 1, name: 'Ben', age: 10, photos: ['url1', 'url2'] }
    const obj83 = { id: 1, name: 'Ben', age: 10, photos: ['url2', 'url1'] }
    const obj9 = { id: 1, name: 'Ben', age: 10, photos: [{ url: 'url2' }] }
    const obj91 = { name: 'Ben', age: 10, photos: [{ url: 'url2' }] }
    const obj10 = { name: 'Ben', age: 10, photos: [{ url: 'url2' }, { url: 'url1' }] }
    it('should return as expected if array included', () => {
      const result_7_8 = objectDiff(obj7, obj8)
      expect(result_7_8).to.be.an('object').that.to.have.all.keys(['k', 'b', 'a'])
      expect(result_7_8.k).to.be.an('array').that.to.have.lengthOf(1).that.to.include('photos')
  
      // Not able to check for array with sub object
      const result_8_81 = objectDiff(obj8, obj81)
      expect(result_8_81).to.be.an('object').that.to.have.all.keys(['k', 'b', 'a'])
      expect(result_8_81.k).to.be.an('array').that.to.be.empty
  
      const result_82_83 = objectDiff(obj82, obj83)
      expect(result_82_83).to.be.an('object').that.to.have.all.keys(['k', 'b', 'a'])
      expect(result_82_83.k).to.be.an('array').that.to.be.empty
  
      // Not able to check for array with sub object
      const result_8_9 = objectDiff(obj8, obj9)
      expect(result_8_9).to.be.an('object').that.to.have.all.keys(['k', 'b', 'a'])
      expect(result_8_9.k).to.be.an('array').that.to.be.empty
  
      const result_9_10 = objectDiff(obj91, obj10)
      expect(result_9_10).to.be.an('object').that.to.have.all.keys(['k', 'b', 'a'])
      expect(result_9_10.k).to.be.an('array').that.to.have.lengthOf(1).that.to.include('photos')
    })
  })
})
