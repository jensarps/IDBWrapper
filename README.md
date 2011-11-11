About
=====

This is a wrapper for indexedDB. It is meant to

a) ease the use of indexedDB and abstract away the differences between the 
existing impls in Chrome and Firefox, and

b) show how IDB works. The code is split up into short methods, so that it's
easy to see what happens in what method.

Usage
=====

Including the IDBStore.js file will add an IDBStore contructor to the global scope.

Alternatively, you can use an AMD loader such as RequireJS to load the file, 
and you will recieve the constructor in your load callback (the constructor 
will then, of course, have whatever name you call it).

You can then create an IDB store:

```javascript
var myStore = new IDBStore();
```

You may pass two parameters to the constructor: the first is an object with optional parameters,
the second is a function reference to a function that is called when the store is ready to use.

The options object may contain the following properties (default values are shown):

```javascript
{
  dbName: 'IDB',
  storeName: 'Store',
  dbVersion: '1.0',
  keyPath: 'id',
  autoIncrement: true,
  onStoreReady: function(){}
}
```

'keyPath' is the name of the property to be used as key index. If 'autoIncrement' is set to true, 
the database will automatically add a unique key to the keyPath index when storing objects missing 
that property.

You can also pass a callback function to the options object. If a callback is provided both as second 
parameter and inside of the options object, the function passed as second parameter will be used.

Methods
=======

Here's an overview of available methods in IDBStore:

Data Manipulation
-----------------

Use the following methods to read and write data:

___

1) The put method.


```javascript
put(/*Object*/ dataObj, /*Function?*/onSuccess, /*Function?*/onError)
```

'dataObj' is the Object to store. 'onSuccess' will be called when the insertion/update was successful, 
and it will recieve the keyPath value (the id, so to say) of the inserted object as first and only 
argument. 'onError' will be called if the insertion/update failed and it will recieve the error event 
object as first and only argument. If the store already contains an object with the given keyPath id,
it will be overwritten by 'dataObj'.

___

2) The get method.

```javascript
get(/*keyPath value*/ key, /*Function?*/onSuccess, /*Function?*/onError)
```

'key' is the keyPath property value (the id) of the object to retrieve. 'onSuccess' will be called if
the get operation was successful, and it will receive the stored object as first and only argument. If
no object was found with the given keyPath value, this argument will be null. 'onError' will be called
if the get operation failed and it will recieve the error event object as first and only argument.

___

3) The getAll method.

```javascript
getAll: function(/*Function?*/onSuccess, /*Function?*/onError)
```

'onSuccess' will be called if the getAll operation was successful, and it will receive an Array of
all objects currently stored in the store as first and only argument. 'onError' will be called if 
the getAll operation failed and it will recieve the error event object as first and only argument.

___

4) The remove method.

```javascript
remove: function(/*keyPath value*/ key, /*Function?*/onSuccess, /*Function?*/onError)
```

'key' is the keyPath property value (the id) of the object to remove. 'onSuccess' will be called if
the remove operation was successful, and it will receive the removed object as first and only argument.
'onError' will be called if the remove operation failed and it will recieve the error event object as first 
and only argument.

___

5) The clear method.

```javascript
clear: function(/*Function?*/onSuccess, /*Function?*/onError)
```

'onSuccess' will be called if the clear operation was successful. 'onError' will be called if the clear 
operation failed and it will recieve the error event object as first and only argument.


Index Operations
----------------

Use the following methods to create, retrieve and delete indices:


___


1) The createIndex method.

```javascript
createIndex: function(/*String*/indexName, /*String?*/propertyName, /*Boolean?*/isUnique, /*Function?*/onSuccess, /*Function?*/onError)
```

Creates an index with the name `indexName` that operates on the property `propertyName`. Set `isUnique`to true
if the index is supposed to be a unique index; this will add a unique constraint to the index. If you try to
store a data object that violates this constraint, insertion will fail. `onSuccess` will be called if
the create operation was successful, and it will receive the created Index as first and only argument.
`onError` will be called if the create operation failed and it will recieve the error event object as first 
and only argument.
Note: If you pass only `indexName` to the method, it will assume that `propertyName` equals `indexName` and that
the index is not unique.

___


2) The hasIndex method.

```javascript
hasIndex: function(/*String*/ indexName)
```

Return true if an index with the given name exists in the store, false if not.


___


