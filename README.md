## Classes

<dl>
<dt><a href="#Model">Model</a></dt>
<dd><p>Create / Get a model</p>
</dd>
<dt><a href="#Schema">Schema</a></dt>
<dd><p>Create / Get a schema</p>
</dd>
</dl>

## Typedefs

<dl>
<dt><a href="#ModelConstructorOptions">ModelConstructorOptions</a> : <code>Object</code></dt>
<dd></dd>
<dt><a href="#ModelHasOptions">ModelHasOptions</a> : <code>Object</code></dt>
<dd></dd>
<dt><a href="#ModelGetOptions">ModelGetOptions</a> : <code>Object</code></dt>
<dd></dd>
<dt><a href="#ModelDelOptions">ModelDelOptions</a> : <code>Object</code></dt>
<dd></dd>
<dt><a href="#ModelSetOptions">ModelSetOptions</a> : <code>Object</code></dt>
<dd></dd>
<dt><a href="#ModelFindReturns">ModelFindReturns</a> : <code>Object</code></dt>
<dd></dd>
<dt><a href="#PaginateOptions">PaginateOptions</a> : <code>Object</code></dt>
<dd></dd>
</dl>

<a name="Model"></a>

## Model
Create / Get a model

**Kind**: global class  

* [Model](#Model)
    * [new Model(folder, options)](#new_Model_new)
    * [.saveMeta()](#Model+saveMeta)
    * [.has(key, options)](#Model+has) ⇒ <code>boolean</code>
    * [.getFilePath(key, options)](#Model+getFilePath) ⇒ <code>string</code>
    * [.getMeta(key, options)](#Model+getMeta) ⇒ <code>object</code> \| <code>null</code>
    * [.get(key, options)](#Model+get) ⇒ <code>object</code> \| <code>null</code>
    * [.mget(keys, options)](#Model+mget) ⇒ <code>array</code>
    * [.set(key, value, options)](#Model+set)
    * [.find(comparator)](#Model+find) ⇒ [<code>ModelFindReturns</code>](#ModelFindReturns) \| <code>null</code>
    * [.findAll(comparator, options)](#Model+findAll) ⇒ [<code>Array.&lt;ModelFindReturns&gt;</code>](#ModelFindReturns)
    * [.keysOf(comparator)](#Model+keysOf) ⇒ <code>array</code>
    * [.countOf(comparator)](#Model+countOf) ⇒ <code>number</code>
    * [.mset(data, options)](#Model+mset)
    * [.del(key, options)](#Model+del)
    * [.delAll()](#Model+delAll)

<a name="new_Model_new"></a>

### new Model(folder, options)
Create a new model instance


| Param | Type | Description |
| --- | --- | --- |
| folder | <code>String</code> | Path to save data of the model |
| options | [<code>ModelConstructorOptions</code>](#ModelConstructorOptions) |  |

**Example**  
```js
const model = new Model('path/to/model', {  rules: { name: [{ required: true }] },  indexes: ['type']})
```
<a name="Model+saveMeta"></a>

### model.saveMeta()
Save cached meta and mapping to filesystem

**Kind**: instance method of [<code>Model</code>](#Model)  
**Example**  
```js
const model = new Model()model.saveMeta()
```
<a name="Model+has"></a>

### model.has(key, options) ⇒ <code>boolean</code>
Check existence of a object with specific key.

**Kind**: instance method of [<code>Model</code>](#Model)  

| Param | Type |
| --- | --- |
| key | <code>string</code> | 
| options | [<code>ModelHasOptions</code>](#ModelHasOptions) | 

**Example**  
```js
const model = new Model()model.on('missed', key => console.log(`${key} is missing`))model.has('test')
```
<a name="Model+getFilePath"></a>

### model.getFilePath(key, options) ⇒ <code>string</code>
Get file path of the object with specific key.

**Kind**: instance method of [<code>Model</code>](#Model)  
**Returns**: <code>string</code> - - If the object not found, empty string will be returned  

| Param | Type |
| --- | --- |
| key | <code>string</code> | 
| options | [<code>ModelHasOptions</code>](#ModelHasOptions) | 

**Example**  
```js
const model = new Model()const file = model.getFilePath('test')
```
<a name="Model+getMeta"></a>

### model.getMeta(key, options) ⇒ <code>object</code> \| <code>null</code>
Get meta of the object with specific key.

**Kind**: instance method of [<code>Model</code>](#Model)  
**Returns**: <code>object</code> \| <code>null</code> - - If the object not found, null will be returned  

| Param | Type |
| --- | --- |
| key | <code>string</code> | 
| options | [<code>ModelHasOptions</code>](#ModelHasOptions) | 

**Example**  
```js
const model = new Model()const meta = model.getMeta('test')
```
<a name="Model+get"></a>

### model.get(key, options) ⇒ <code>object</code> \| <code>null</code>
Get object with specific key, null will be returned if object not existed

**Kind**: instance method of [<code>Model</code>](#Model)  

| Param | Type | Description |
| --- | --- | --- |
| key | <code>string</code> | ID of an object |
| options | [<code>ModelGetOptions</code>](#ModelGetOptions) |  |

**Example**  
```js
const model = new Model()model.on('error', (func, err, { key } = {}) => console.log(func, key, err))const data = model.get('key1')console.log(data)
```
<a name="Model+mget"></a>

### model.mget(keys, options) ⇒ <code>array</code>
Get objects with list of ID

**Kind**: instance method of [<code>Model</code>](#Model)  

| Param | Type | Description |
| --- | --- | --- |
| keys | <code>array</code> | ID list |
| options | [<code>ModelGetOptions</code>](#ModelGetOptions) |  |

**Example**  
```js
const model = new Model()model.on('error', (func, err, { key } = {}) => console.log(func, key, err))const data = model.mget(['key1', 'key2'])console.log(data)
```
<a name="Model+set"></a>

### model.set(key, value, options)
Create of update an object with specific key

**Kind**: instance method of [<code>Model</code>](#Model)  

| Param | Type | Description |
| --- | --- | --- |
| key | <code>string</code> | ID of an object |
| value | <code>object</code> | Data to be saved in the JSON file |
| options | [<code>ModelSetOptions</code>](#ModelSetOptions) |  |

**Example**  
```js
const model = new Model()model.on('error', (func, err, { key, value, index } = {}) => console.log(func, key, err, value, index))model.on('set', (key, value, index, old) => console.log(key, value, index, old))model.set('key1', { name: 'Ben' }).then(data => {  console.log('Data is saved', data)}).catch(error => {  console.error(error)}) 
```
<a name="Model+find"></a>

### model.find(comparator) ⇒ [<code>ModelFindReturns</code>](#ModelFindReturns) \| <code>null</code>
Get the first object which the comparator returns true

**Kind**: instance method of [<code>Model</code>](#Model)  

| Param | Type |
| --- | --- |
| comparator | <code>function</code> | 

**Example**  
```js
const model = new Model()const item = model.find(item => item.id === 'key1')console.log(item)
```
<a name="Model+findAll"></a>

### model.findAll(comparator, options) ⇒ [<code>Array.&lt;ModelFindReturns&gt;</code>](#ModelFindReturns)
Get all objects which the comparator returns true

**Kind**: instance method of [<code>Model</code>](#Model)  

| Param | Type |
| --- | --- |
| comparator | <code>function</code> | 
| options | [<code>PaginateOptions</code>](#PaginateOptions) | 

**Example**  
```js
const model = new Model()const list = model.findAll(item => item.role === 'admin').map(({ id, data, index }) => {  return { id, ...data, ...index }})console.log(list)
```
<a name="Model+keysOf"></a>

### model.keysOf(comparator) ⇒ <code>array</code>
Keys of item matches criteria

**Kind**: instance method of [<code>Model</code>](#Model)  

| Param | Type |
| --- | --- |
| comparator | <code>function</code> | 

**Example**  
```js
const model = new Model()const keys = model.keysOf(item => item.role === 'admin')console.log(keys)
```
<a name="Model+countOf"></a>

### model.countOf(comparator) ⇒ <code>number</code>
Count of item matches criteria

**Kind**: instance method of [<code>Model</code>](#Model)  

| Param | Type |
| --- | --- |
| comparator | <code>function</code> | 

**Example**  
```js
const model = new Model()const count = model.countOf(item => item.role === 'admin')console.log(count)
```
<a name="Model+mset"></a>

### model.mset(data, options)
Bulk create or update objects

**Kind**: instance method of [<code>Model</code>](#Model)  

| Param | Type |
| --- | --- |
| data | <code>array</code> \| <code>object</code> | 
| options | [<code>ModelSetOptions</code>](#ModelSetOptions) | 

**Example**  
```js
const model = new Model()model.mset([  { id: 'item1', name: 'Peter' },  { name: 'John' }]).then(list => {  console.log('List of objects been saved', list)}).catch(console.error)
```
<a name="Model+del"></a>

### model.del(key, options)
Delete object with specific key

**Kind**: instance method of [<code>Model</code>](#Model)  

| Param | Type | Description |
| --- | --- | --- |
| key | <code>string</code> | ID of an object |
| options | [<code>ModelDelOptions</code>](#ModelDelOptions) |  |

**Example**  
```js
const model = new Model()model.on('deleted', (key, data) => console.log('deleted', key, data))model.on('error', (func, err, { key } = {}) => console.log(func, key, err))model.del('key1').then(obj => {  console.log('Object been deleted', obj)}).catch(console.error)
```
<a name="Model+delAll"></a>

### model.delAll()
Delete all objects

**Kind**: instance method of [<code>Model</code>](#Model)  
**Example**  
```js
const model = new Model()model.delAll()
```
<a name="Schema"></a>

## Schema
Create / Get a schema

**Kind**: global class  

* [Schema](#Schema)
    * [new Schema(folder)](#new_Schema_new)
    * [.model(name, options)](#Schema+model) ⇒ [<code>Model</code>](#Model)
    * [.schema(name)](#Schema+schema) ⇒ [<code>Schema</code>](#Schema)

<a name="new_Schema_new"></a>

### new Schema(folder)
Create a new schema instance


| Param | Type | Description |
| --- | --- | --- |
| folder | <code>string</code> | path to save the schema |

**Example**  
```js
const schema = new Schema('path/to/schema')
```
<a name="Schema+model"></a>

### schema.model(name, options) ⇒ [<code>Model</code>](#Model)
Create or get an instance of sub model

**Kind**: instance method of [<code>Schema</code>](#Schema)  

| Param | Type | Description |
| --- | --- | --- |
| name | <code>string</code> | folder name of the sub model |
| options | [<code>ModelConstructorOptions</code>](#ModelConstructorOptions) |  |

**Example**  
```js
const schema = new Schema()const model = schema.model('test')
```
<a name="Schema+schema"></a>

### schema.schema(name) ⇒ [<code>Schema</code>](#Schema)
Create or get an instance of sub schema

**Kind**: instance method of [<code>Schema</code>](#Schema)  

| Param | Type | Description |
| --- | --- | --- |
| name | <code>string</code> | folder name of the sub schema |

**Example**  
```js
const schema = new Schema()const sub = schema.schema('test')
```
<a name="ModelConstructorOptions"></a>

## ModelConstructorOptions : <code>Object</code>
**Kind**: global typedef  
**Properties**

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| [rules] | <code>string</code> | <code>&quot;{}&quot;</code> | Rules for the validators, refer to https://www.npmjs.com/package/async-validator |
| [indexes] | <code>string</code> | <code>&quot;[]&quot;</code> | Name of the fields to save value in meta for searching |

<a name="ModelHasOptions"></a>

## ModelHasOptions : <code>Object</code>
**Kind**: global typedef  
**Properties**

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| [event] | <code>boolean</code> | <code>false</code> | Indicates whether 'missed' event is triggered if not found |

<a name="ModelGetOptions"></a>

## ModelGetOptions : <code>Object</code>
**Kind**: global typedef  
**Properties**

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| [event] | <code>boolean</code> | <code>false</code> | Indicates whether event is triggered if not found |

<a name="ModelDelOptions"></a>

## ModelDelOptions : <code>Object</code>
**Kind**: global typedef  
**Properties**

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| [event] | <code>boolean</code> | <code>false</code> | Indicates whether event is triggered if not found |
| [real] | <code>boolean</code> | <code>true</code> | Indicates whether the JSON file will be really removed, if false, JSON file won't be delete but just delete key in meta |
| [saveMeta] | <code>boolean</code> | <code>true</code> | Indicates whether meta file will be updated immediate |

<a name="ModelSetOptions"></a>

## ModelSetOptions : <code>Object</code>
**Kind**: global typedef  
**Properties**

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| [event] | <code>boolean</code> | <code>false</code> | Indicates whether event is triggered if not found |
| [saveMeta] | <code>boolean</code> | <code>true</code> | Indicates whether meta file will be updated immediate |
| [indexes] | <code>object</code> | <code>{}</code> | Additional indexes to save in meta when saving the item |

<a name="ModelFindReturns"></a>

## ModelFindReturns : <code>Object</code>
**Kind**: global typedef  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| key | <code>string</code> | ID of the object |
| data | <code>object</code> | The data saved in JSON file |
| index | <code>object</code> | The data saved in meta |

<a name="PaginateOptions"></a>

## PaginateOptions : <code>Object</code>
**Kind**: global typedef  
**Properties**

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| [offset] | <code>int</code> | <code>0</code> | The first {offset} matched items are ignored |
| [limit] | <code>int</code> | <code>0</code> | Page size, if it is 0 then no limit |

