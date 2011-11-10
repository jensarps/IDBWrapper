About
=====

This is a wrapper for indexedDB. It is meant to

a) ease the use of indexedDB and abstract away the differences between the 
existing impls in Chrome and Firefox (yes, it works in both), and

b) show how IDB works. The code is split up into short methods, so that it's
easy to see what happens in what method.

"Showing how it works" is the main intention of this project. IndexedDB is 
all the buzz, but only a few people actually know how to use it. 

The code in IDBWrapper.js is not optimized for anything, nor minified or anything. 
It is meant to be read and easy to understand. So, please, go ahead and check out
the source!

NOTE: This is a work in progress. IDBWrapper still misses index and keyRange operations,
and this Readme only covers basic CRUD operations. I will add more content to both before
too long.

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

