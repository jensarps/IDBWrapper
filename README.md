About
=====

This is a wrapper for indexedDB. It is meant to

a) ease the use of indexedDB and abstract away the differences between the
existing impls in Chrome, Firefox and IE10 (yes, it works in all three), and

b) show how IDB works. The code is split up into short methods, so that it's
easy to see what happens in what method.

"Showing how it works" is the main intention of this project. IndexedDB is
all the buzz, but only a few people actually know how to use it.

The code in IDBWrapper.js is not optimized for anything, nor minified or anything.
It is meant to be read and easy to understand. So, please, go ahead and check out
the source!

There are two tutorials to get you up and running:

Part 1: Setup and CRUD operations
http://jensarps.de/2011/11/25/working-with-idbwrapper-part-1/

Part 2: Running Queries against the store
http://jensarps.de/2012/11/13/working-with-idbwrapper-part-2/

##November Rewrite

I rewrote IDBWrapper to cope with all the issues, and the new version is on
master since Nov, 13th 2012. The API didn't change much, I just removed some
of the methods. Method signatures remain unchanged.

However, if you have a previous version of IDBWrapper in use, there's an
issue: The new version won't be able to access the store created with the old
version, because database names changed. In that case, you need to manually
migrate the data: Include both versions of IDBWrapper (use a different name for
them), do a getAll() on the old store and write the data to the new store.

I am very sorry about any inconveniences, but there was no other way.

The 'old' version of IDBWrapper is still available in the `legacy` branch:
https://github.com/jensarps/IDBWrapper/tree/legacy

Also, "showing how it works" is no longer the main intention behind this. Now,
it's rather "just works".


Examples
========

There are some examples to run right in your browser over here: http://jensarps.github.com/IDBWrapper/example/

The source for these examples are in the `example` folder of this repository.

Usage
=====

Including the idbstore.js file will add an IDBStore constructor to the global scope.

Alternatively, you can use an AMD loader such as RequireJS, or a CommonJS loader
to load the module, and you will receive the constructor in your load callback
(the constructor will then, of course, have whatever name you call it).

You can then create an IDB store:

```javascript
var myStore = new IDBStore();
```

You may pass two parameters to the constructor: the first is an object with optional parameters,
the second is a function reference to a function that is called when the store is ready to use.

The options object may contain the following properties (default values are shown):

```javascript
{
  storeName: 'Store',
  dbVersion: 1,
  keyPath: 'id',
  autoIncrement: true,
  indexes: [],
  onStoreReady: function(){},
  onError: function(error){ throw error; }
}
```

'keyPath' is the name of the property to be used as key index. If 'autoIncrement' is set to true,
the database will automatically add a unique key to the keyPath index when storing objects missing
that property. 'indexes' contains objects defining indexes (see below for details on indexes).

'onError' gets called if an error occurred while trying to open the store. It
receives the error instance as only argument.

As an alternative to passing a ready handler as second argument, you can also
pass it in the 'onStoreReady' property. If a callback is provided both as second
parameter and inside of the options object, the function passed as second
parameter will be used.

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

`dataObj` is the Object to store. `onSuccess` will be called when the insertion/update was successful,
and it will receive the keyPath value (the id, so to say) of the inserted object as first and only
argument. `onError` will be called if the insertion/update failed and it will receive the error event
object as first and only argument. If the store already contains an object with the given keyPath id,
it will be overwritten by `dataObj`.

___


2) The get method.

```javascript
get(/*keyPath value*/ key, /*Function?*/onSuccess, /*Function?*/onError)
```

`key` is the keyPath property value (the id) of the object to retrieve. `onSuccess` will be called if
the get operation was successful, and it will receive the stored object as first and only argument. If
no object was found with the given keyPath value, this argument will be null. `onError` will be called
if the get operation failed and it will receive the error event object as first and only argument.

___


3) The getAll method.

```javascript
getAll: function(/*Function?*/onSuccess, /*Function?*/onError)
```

`onSuccess` will be called if the getAll operation was successful, and it will receive an Array of
all objects currently stored in the store as first and only argument. `onError` will be called if
the getAll operation failed and it will receive the error event object as first and only argument.

___


4) The remove method.

```javascript
remove: function(/*keyPath value*/ key, /*Function?*/onSuccess, /*Function?*/onError)
```

`key` is the keyPath property value (the id) of the object to remove. `onSuccess` will be called if
the remove operation was successful, and it _should_ receive `false` as first and only argument if the
object to remove was not found, and `true` if it was found and removed.

NOTE: FF 8 will pass the key to the onSuccess handler, no matter if there is an corresponding object
or not. Chrome 15 will pass `null` if removal was successful, and call the error handler if the object
wasn't found. Chrome 17 will behave as described above.

`onError` will be called if the remove operation failed and it will receive the error event object as first
and only argument.

___


5) The clear method.

```javascript
clear: function(/*Function?*/onSuccess, /*Function?*/onError)
```

`onSuccess` will be called if the clear operation was successful. `onError` will be called if the clear
operation failed and it will receive the error event object as first and only argument.

___


6) The batch method.

```javascript
batch: function (/*Array*/operations, /*Function?*/onSuccess, /*Function?*/onError)
```

`batch` expects an array of operations that you want to apply in a single
IndexedDB transaction. `operations` is an Array of objects, each containing two
properties, defining the type of operation. There are two operations
supported, put and remove. A put entry looks like this:

```javascript
{ type: "put", value: dataObj } // dataObj being the object to store
```

A remove entry looks like this;

```javascript
{ type: "remove", key: someKey } // someKey being the keyPath value of the item to remove
```

You can mix both types in the `operations` Array:

```javascript
batch([
  { type: "put", value: dataObj },
  { type: "remove", key: someKey }
], onSuccess, onError)
```

`onSuccess` will be called if all operations were successful and will receive no
arguments. `onError` will be called if an error happens for one of the
operations and will receive three arguments: the Error instance, the type of
operation that caused the error and either the key or the value property
(depending on the type).

If an error occurs, no changes will be made to the store, even if some
of the given operations would have succeeded.


Index Operations
----------------

To create indexes, you need to pass the index information to the IDBStore()
constructor, for example:


```javascript
{
  storeName: 'customers',
  dbVersion: 1,
  keyPath: 'customerid',
  autoIncrement: true,
  onStoreReady: function(){},
  indexes: [
    { name: 'lastname', keyPath: 'lastname', unique: false, multiEntry: false }
  ]
}
```

An entry in the index Array is an object containing the following properties:

The `name` property is the identifier of the index. If you want to work with the created index later, this name is used to identify the index. This is the only property that is mandatory.

The `keyPath` property is the name of the property in your stored data that you want to index. If you omit that, IDBWrapper will assume that it is the same as the provided name, and will use this instead.

The `unique` property tells the store whether the indexed property in your data is unique. If you set this to true, it will add a uniqueness constraint to the store which will make it throw if you try to store data that violates that constraint. If you omit that, IDBWrapper will set this to false.

The `multiEntry` property is kinda weird. You can read up on it here: http://www.w3.org/TR/IndexedDB/#dfn-multientry. However, you can live perfectly fine with setting this to false (or just omitting it, this is set to false by default).


If you want to add an index to an existing store, you need to increase the
version number of your store, as adding an index changes the structure of
the database.

To modify an index, modify the object in the indexes Array in the constructor.
Again, you need to increase the version of your store.

In addition, there are still some convenience methods available:

___


1) The hasIndex method.

```javascript
hasIndex: function(/*String*/ indexName)
```

Return true if an index with the given name exists in the store, false if not.

___

2) The getIndexList method.

```javascript
getIndexList: function()
```

Returns a `DOMStringList` with all existing indices.


Running Queries
---------------

To run queries, IDBWrapper provides an `iterate()` method. To create keyRanges,
there is the `makeKeyRange()` method. In addition to these, IDBWrapper comes
with a `count()` method.

___


1) The iterate method.


```javascript
iterate: function(/*Function*/ onItem, /*Object*/ iterateOptions)
```

The `onItem` callback will be called once for every match. It will receive three arguments: the object that matched the query, a reference to the current cursor object (IDBWrapper uses IndexedDB's Cursor internally to iterate), and a reference to the current ongoing transaction.

There's one special situation: if you didn't pass an onEnd handler in the options objects (see below), the onItem handler will be called one extra time when the transaction is over. In this case, it will receive null as only argument. So, to check when the iteration is over and you won't get any more data objects, you can either pass an onEnd handler, or check for null in the onItem handler.

The `iterateOptions` object can contain one or more of the following properties:


The `index` property contains the name of the index to operate on. If you omit this, IDBWrapper will use the store's keyPath as index.

In the `keyRange` property you can pass a keyRange.

The `order` property can be set to 'ASC' or 'DESC', and determines the ordering direction of results. If you omit this, IDBWrapper will use 'ASC'.

The `filterDuplicates` property is an interesting one: If you set this to true (it defaults to false), and have several objects that have the same value in their key, the store will only fetch the first of those. It is not about objects being the same, it's about their key being the same. For example, in the customers database are a couple of guys having 'Smith' as last name. Setting filterDuplicates to true in the above example will make `iterate()` call the onItem callback only for the first of those.

The `writeAccess` property defaults to false. If you need write access to the store during the iteration, you need to set this to true.

In the `onEnd` property you can pass a callback that gets called after the iteration is over and the transaction is closed. It does not receive any arguments.

In the `onError` property you can pass a custom error handler. In case of an error, it will be called and receives the Error object as only argument.

___


2) The makeKeyRange method.


```javascript
makeKeyRange: function(/*Object*/ keyRangeOptions)
```

Returns an IDBKeyRange.

The `keyRangeOptions` object must have one or more of the following properties:

`lower`: The lower bound of the range

`excludeLower`: Boolean, whether to exclude the lower bound itself. Default: false

`upper`: The upper bound of the range

`excludeUpper`: Boolean, whether to exclude the upper bound itself. Default: false

___


3) The count method.


```javascript
count: function(/*Function*/ onSuccess, /*Object*/ countOptions)
```

The onSuccess receives the result of the count as only argument.

The `countOptions` object may have one or more of the following properties:

index: The name of an index to operate on.

keyRange: A keyRange to use

