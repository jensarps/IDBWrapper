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