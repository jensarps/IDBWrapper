var IDBStore;

(function(){

var defaults = {
	dbName: 'IDB',
	storeName: 'Store',
	dbVersion: '1.0',
	keyPath: 'id',
	autoIncrement: true,
	onStoreReady: function(){}
};

IDBStore = function(kwArgs, onStoreReady){
	mixin(this, defaults);
	mixin(this, kwArgs);
	onStoreReady && (this.onStoreReady = onStoreReady);
	this.idb = window.indexedDB || window.webkitIndexedDB || window.mozIndexedDB || window.msIndexedDB;
	this.consts = window.IDBTransaction || window.webkitIDBTransaction || window.msIndexedDB;
	this.openDB();
};

IDBStore.prototype = {
	
	db: null,
	
	dbName: null,
	
	dbDescription: null,
	
	dbVersion: null,
	
	store: null,
	
	storeName: null,
	
	keyPath: null,
	
	autoIncrement: null,
	
	features: null,
	
	onStoreReady: null,
	
	openDB: function(){
		var openRequest = this.idb.open(this.dbName, this.dbDescription);
		openRequest.onerror = function(error){ console.error('Could not open database.', error); };
		openRequest.onsuccess = hitch(this, function(event){
			this.db = event.target.result;
			this.checkVersion(hitch(this, function(){
				this.getObjectStore(hitch(this, function(){
					this.testFeatures(this.onStoreReady)
				}));
			}));
		});
	},
	
	testFeatures: function(callback){
		var features = this.features = {};
		
		// In Chrome, there's no getAll method (getAll is not part of the spec, but handy)
		var getAllTransaction = this.db.transaction([this.storeName], this.consts.READ_ONLY);
		features.hasGetAll = !!getAllTransaction.objectStore(this.storeName).getAll;
		getAllTransaction.abort();
		
		// In FF, autoIncrement doesn't work.
		// We won't test for that, as testing
		// sometimes fails in Chrome (it's a long
		// story).
		features.hasAutoIncrement = !window.mozIndexedDB;
		
		callback && callback();
	},
	
	/* version */
	
	checkVersion: function(onSuccess, onError){
		if(this.getVersion() != this.dbVersion){
			this.setVersion(onSuccess, onError);
		}else{
			onSuccess && onSuccess();
		}
	},
	
	getVersion: function(){
		return this.db.version;
	},
	
	setVersion: function(onSuccess, onError){
		onError || (onError = function(error){ console.error('Failed to set version.', error); });
		var versionRequest = this.db.setVersion(this.dbVersion);
		versionRequest.onerror = onError;
		versionRequest.onblocked = onError;
		versionRequest.onsuccess = onSuccess;
	},
	
	/* object store handling */
	
	getObjectStore: function(onSuccess, onError){
		if(this.hasObjectStore()){
			this.openExistingObjectStore(onSuccess, onError);
		}else{
			this.createNewObjectStore(onSuccess, onError);
		}
	},
	
	hasObjectStore: function(){
		return this.db.objectStoreNames.contains(this.storeName);
	},
	
	createNewObjectStore: function(onSuccess, onError){
		console.log('Creating new objectStore:', this.storeName);
		this.setVersion(hitch(this, function(){
			this.store = this.db.createObjectStore(this.storeName, { keyPath: this.keyPath, autoIncrement: this.autoIncrement});
			console.log('Store ready:', this.store);
			onSuccess && onSuccess(this.store);
		}), onError);
	},
	
	openExistingObjectStore: function(onSuccess, onError){
		// Having a ref to the store in some transaction state
		// is not useful; do we really want to offer this method?
		console.log('Opening existing objectStore:', this.storeName);
		var emptyTransaction = this.db.transaction([], this.consts.READ_ONLY, 0);
		this.store = emptyTransaction.objectStore(this.storeName);
		console.log('Store ready:', this.store);
		onSuccess && onSuccess(this.store);
	},
	
	deleteObjectStore: function(onSuccess, onError){
		onError || (onError = function(error){ console.error('Failed to delete objectStore.', error); });
		console.log('Deleting objectStore:', this.storeName);
		this.setVersion(hitch(this, function(){
			this.db.deleteObjectStore(this.storeName);
			var success = !this.hasObjectStore();
			onSuccess && success && onSuccess();
			onError && !success && onError();
		}), onError);
	},
	
	/* data manipulation */
	
	put: function(dataObj, onSuccess, onError){
		// TODO: Check for missing keyPath property.
		onError || (onError = function(error) { console.error('Could not write data.', error); });
		onSuccess || (onSuccess = noop);
		if(typeof dataObj[this.keyPath] == 'undefined' && !this.features.hasAutoIncrement){
			dataObj[this.keyPath] = this._getUID();
		}
		var putTransaction = this.db.transaction([this.storeName], this.consts.READ_WRITE, 1000);
		var putRequest = putTransaction.objectStore(this.storeName).put(dataObj);
		putRequest.onsuccess = function(event){ onSuccess(event.target.result); };
		putRequest.onerror = onError;
	},
	
	get: function(key, onSuccess, onError){
		onError || (onError = function(error) { console.error('Could not read data.', error); });
		onSuccess || (onSuccess = noop);
		var getTransaction = this.db.transaction([this.storeName], this.consts.READ_ONLY, 1000);
		var getRequest = getTransaction.objectStore(this.storeName).get(key);
		getRequest.onsuccess = function(event){ onSuccess(event.target.result); };
		getRequest.onerror = onError;
	},
	
	remove: function(key, onSuccess, onError){
		onError || (onError = function(error) { console.error('Could not remove data.', error); });
		onSuccess || (onSuccess = noop);
		var removeTransaction = this.db.transaction([this.storeName], this.consts.READ_WRITE);
		var deleteRequest = removeTransaction.objectStore(this.storeName).delete(key);
		deleteRequest.onsuccess = function(event){ onSuccess(event.target.result); };
		deleteRequest.onerror = onError;
	},
	
	getAll: function(onSuccess, onError){
		onError || (onError = function(error) { console.error('Could not read data.', error); });
		onSuccess || (onSuccess = noop);
		var getAllTransaction = this.db.transaction([this.storeName], this.consts.READ_ONLY);
		if(this.features.hasGetAll){
			var getAllRequest = getAllTransaction.objectStore(this.storeName).getAll();
			getAllRequest.onsuccess = function(event){ onSuccess(event.target.result); };
			getAllRequest.onerror = onError;
		}else{
			this._getAllCursor(getAllTransaction, onSuccess, onError);
		}
	},
	
	_getAllCursor: function(tr, onSuccess, onError){
		var all = [];
		var store = tr.objectStore(this.storeName);
		var cursorRequest = store.openCursor();
		
		cursorRequest.onsuccess = function(event) {
			var cursor = event.target.result;
			if (cursor) {
				all.push(cursor.value);
				cursor.continue();
			}
			else {
				onSuccess(all);
			}
		};
		cursorRequest.onError = onError;
	},
	
	clear: function(onSuccess, onError){
		onError || (onError = function(error) { console.error('Could not clear store.', error); });
		onSuccess || (onSuccess = noop);
		var clearTransaction = this.db.transaction([this.storeName], this.consts.READ_WRITE);
		var clearRequest = clearTransaction.objectStore(this.storeName).clear();
		clearRequest.onsuccess = function(event){ onSuccess(event.target.result); };
		clearRequest.onerror = onError;
	},
	
	_getUID: function(){
		// NOTE: What we *should* do here to mimic Chrome's is to do a getAll 
		// call and iterate over the existing keys and find the key that is
		// numeric and of the highest value, and return key + 1. But, as
		// can see, this might be a pretty load intensive operation.
		// The code below is commonly used to generate unique IDs; keep in mind
		// though, that it's result will just be a random number, not a 
		// reliably unique one.
        var S4 = function () {
            return (((1+Math.random())*0x10000)|0).toString(16).substring(1);
        }
        return (S4()+S4()+"-"+S4()+"-"+S4()+"-"+S4()+"-"+S4()+S4()+S4());
	}
	
	/* indexing */
	
	createIndex: function(column, indexName, isUnique){
		var res = this.store.createIndex(column, indexName, { unique: !!isUnique });
		console.log('index res:', res);
	},
	
	/* key ranges / cursors */
	// TODO: implement
	
};

/** helpers **/

var noop = function(){};
var empty = {};
var mixin = function(target, source){
	var name, s;
	for(name in source){
		s = source[name];
		if(s !== empty[name] && s !== target[name]){
			target[name] = s;
		}
	}
	return target;
};
var hitch = function (scope, method){
	if(!method){ method = scope; scope = null; }
	if(typeof method == "string"){
		scope = scope || window;
		if(!scope[method]){ throw(['method not found']); }
		return function(){ return scope[method].apply(scope, arguments || []); };
	}
	return !scope ? method : function(){ return method.apply(scope, arguments || []); };
};

})();