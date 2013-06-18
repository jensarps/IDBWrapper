/*
 * IDBWrapper - A cross-browser wrapper for IndexedDB
 * Copyright (c) 2011 Jens Arps
 * http://jensarps.de/
 *
 * Licensed under the MIT (X11) license
 */

(function (name, definition, global) {
  if (typeof define === 'function') {
    define(definition);
  } else {
    global[name] = definition();
  }
})('IDBStore', function () {

  var IDBStore;

  var defaults = {
    dbName: 'IDB',
    storeName: 'Store',
    dbVersion: 1,
    keyPath: 'id',
    autoIncrement: true,
    onStoreReady: function () {
    }
  };

  IDBStore = function (kwArgs, onStoreReady) {

    function fixupConstants (object, constants) {
      for (var prop in constants) {
        if (!(prop in object))
          object[prop] = constants[prop];
      }
    }

    mixin(this, defaults);
    mixin(this, kwArgs);
    onStoreReady && (this.onStoreReady = onStoreReady);

    this.idb = window.indexedDB || window.webkitIndexedDB || window.mozIndexedDB;
    this.consts = window.IDBTransaction || window.webkitIDBTransaction;
    fixupConstants(this.consts, {
      'READ_ONLY': 'readonly',
      'READ_WRITE': 'readwrite',
      'VERSION_CHANGE': 'versionchange'
    });
    this.cursor = window.IDBCursor || window.webkitIDBCursor;
    fixupConstants(this.cursor, {
      'NEXT': 'next',
      'NEXT_NO_DUPLICATE': 'nextunique',
      'PREV': 'prev',
      'PREV_NO_DUPLICATE': 'prevunique'
    });
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

    openDB: function () {

      var features = this.features = {};
      features.hasAutoIncrement = !window.mozIndexedDB; // TODO: Still, really?

      var openRequest = this.idb.open(this.dbName);

      openRequest.onerror = hitch(this, function (error) {
        var gotVersionErr = false;
        if ('error' in error.target) {
          gotVersionErr = error.target.error.name == "VersionError";
        } else if ('errorCode' in error.target) {
          gotVersionErr = error.target.errorCode == 12; // TODO: Use const
        }

//        if (gotVersionErr) {
//          this.dbVersion++;
//          setTimeout(hitch(this, 'openDB'));
//        } else {
            console.error('Could not open database, error', error);
//        }
      });

      openRequest.onsuccess = hitch(this, function (event) {
        this.db = event.target.result;

        this.db.onversionchange = function (event) {

          //event.target.close();
        };

        this.setVersion(hitch(this, function(){
          if(!this.hasObjectStore()) {
            this.store = this.db.createObjectStore(this.storeName, { keyPath: this.keyPath, autoIncrement: this.autoIncrement});
          }
        }));

        this.onStoreReady(this.store);
      });
    },

    deleteDatabase: function () {
      if (this.idb.deleteDatabase) {
        this.idb.deleteDatabase(this.dbName);
      }
    },

    enterMutationState: function (onSuccess, onError) {
      this.setVersion(onSuccess, onError);
    },


    /**************
     * versioning *
     **************/

    checkVersion: function (onSuccess, onError, options) {
      options || (options = {});
      if (this.getVersion() != this.dbVersion) {
        this.setVersion(onSuccess, onError, options);
      } else {
        onSuccess && onSuccess();
      }
    },

    getVersion: function () {
      return this.db.version;
    },

    setVersion: function (onSuccess, onError, options) {
      options || (options = {});
      onError || (onError = function (error) {
        console.error('Failed to set version.', error);
      });
      var versionRequest = this.db.setVersion(this.dbVersion);
      versionRequest.onerror = onError;
      versionRequest.onblocked = onError;

      versionRequest.onsuccess = function (evt) {
        if (options.waitForTransactionEnd) {
          var transaction = evt.target.result;
          transaction.oncomplete = onSuccess;
        } else {
          onSuccess();
        }
      };
    },

    /*************************
     * object store handling *
     *************************/


    hasObjectStore: function () {
      return this.db.objectStoreNames.contains(this.storeName);
    },

    createNewObjectStore: function (onSuccess, onError) {
      this.enterMutationState(hitch(this, function () {
        this.store = this.db.createObjectStore(this.storeName, { keyPath: this.keyPath, autoIncrement: this.autoIncrement});
        onSuccess && onSuccess(this.store);
      }), onError);
    },

    openExistingObjectStore: function (onSuccess, onError) {
      var emptyTransaction = this.db.transaction([this.storeName], this.consts.READ_ONLY);
      this.store = emptyTransaction.objectStore(this.storeName);
      emptyTransaction.abort();
      onSuccess && onSuccess(this.store);
    },

    deleteObjectStore: function (onSuccess, onError) {
      onError || (onError = function (error) {
        console.error('Failed to delete objectStore.', error);
      });
      this.enterMutationState(hitch(this, function (evt) {
        var db = evt.target.result;
        db.deleteObjectStore(this.storeName);
        var success = !this.hasObjectStore();
        onSuccess && success && onSuccess();
        onError && !success && onError();
      }), onError);
    },


    /*********************
     * data manipulation *
     *********************/


    put: function (dataObj, onSuccess, onError) {
      onError || (onError = function (error) {
        console.error('Could not write data.', error);
      });
      onSuccess || (onSuccess = noop);
      if (typeof dataObj[this.keyPath] == 'undefined' && !this.features.hasAutoIncrement) {
        dataObj[this.keyPath] = this._getUID();
      }
      var putTransaction = this.db.transaction([this.storeName], this.consts.READ_WRITE);
      var putRequest = putTransaction.objectStore(this.storeName).put(dataObj);
      putRequest.onsuccess = function (event) {
        onSuccess(event.target.result);
      };
      putRequest.onerror = onError;
    },

    get: function (key, onSuccess, onError) {
      onError || (onError = function (error) {
        console.error('Could not read data.', error);
      });
      onSuccess || (onSuccess = noop);
      var getTransaction = this.db.transaction([this.storeName], this.consts.READ_ONLY);
      var getRequest = getTransaction.objectStore(this.storeName).get(key);
      getRequest.onsuccess = function (event) {
        onSuccess(event.target.result);
      };
      getRequest.onerror = onError;
    },

    remove: function (key, onSuccess, onError) {
      onError || (onError = function (error) {
        console.error('Could not remove data.', error);
      });
      onSuccess || (onSuccess = noop);
      var removeTransaction = this.db.transaction([this.storeName], this.consts.READ_WRITE);
      var deleteRequest = removeTransaction.objectStore(this.storeName).delete(key);
      deleteRequest.onsuccess = function (event) {
        onSuccess(event.target.result);
      };
      deleteRequest.onerror = onError;
    },

    getAll: function (onSuccess, onError) {
      onError || (onError = function (error) {
        console.error('Could not read data.', error);
      });
      onSuccess || (onSuccess = noop);
      var getAllTransaction = this.db.transaction([this.storeName], this.consts.READ_ONLY);
      var store = getAllTransaction.objectStore(this.storeName);
      if (store.getAll) {
        var getAllRequest = store.getAll();
        getAllRequest.onsuccess = function (event) {
          onSuccess(event.target.result);
        };
        getAllRequest.onerror = onError;
      } else {
        this._getAllCursor(getAllTransaction, onSuccess, onError);
      }
    },

    _getAllCursor: function (tr, onSuccess, onError) {
      var all = [];
      var store = tr.objectStore(this.storeName);
      var cursorRequest = store.openCursor();

      cursorRequest.onsuccess = function (event) {
        var cursor = event.target.result;
        if (cursor) {
          all.push(cursor.value);
          cursor['continue']();
        }
        else {
          onSuccess(all);
        }
      };
      cursorRequest.onError = onError;
    },

    clear: function (onSuccess, onError) {
      onError || (onError = function (error) {
        console.error('Could not clear store.', error);
      });
      onSuccess || (onSuccess = noop);
      var clearTransaction = this.db.transaction([this.storeName], this.consts.READ_WRITE);
      var clearRequest = clearTransaction.objectStore(this.storeName).clear();
      clearRequest.onsuccess = function (event) {
        onSuccess(event.target.result);
      };
      clearRequest.onerror = onError;
    },

    _getUID: function () {
      // FF bails at times on non-numeric ids. So we take an even
      // worse approach now, using current time as id. Sigh.
      return +new Date();
    },


    /************
     * indexing *
     ************/

    createIndex: function (indexName, propertyName, isUnique, onSuccess, onError) {
      onError || (onError = function (error) {
        console.error('Could not create index.', error);
      });
      onSuccess || (onSuccess = noop);
      propertyName || (propertyName = indexName);

      var that = this;

      this.enterMutationState(hitch(this, function (evt) {
        var result = evt.target.result;
        var index;
        if (result.objectStore) { // transaction
          index = db.objectStore(this.storeName).createIndex(indexName, propertyName, { unique: !!isUnique });
        } else { // db
          var putTransaction = result.transaction([that.storeName] /* , this.consts.READ_WRITE */);
          var store = putTransaction.objectStore(that.storeName);
          index = store.createIndex(indexName, propertyName, { unique: !!isUnique });
        }
        onSuccess(index);
      }), onError);
    },

    getIndex: function (indexName) {
      return this.store.index(indexName);
    },

    getIndexList: function () {
      return this.store.indexNames;
    },

    hasIndex: function (indexName) {
      return this.store.indexNames.contains(indexName);
    },

    removeIndex: function (indexName, onSuccess, onError) {
      onError || (onError = function (error) {
        console.error('Could not remove index.', error);
      });
      onSuccess || (onSuccess = noop);
      this.enterMutationState(hitch(this, function (evt) {
        evt.target.result.objectStore(this.storeName).deleteIndex(indexName);
        onSuccess();
      }), onError);
    },

    /**********
     * cursor *
     **********/

    iterate: function (callback, options) {
      options = mixin({
        index: null,
        order: 'ASC',
        filterDuplicates: false,
        keyRange: null,
        writeAccess: false,
        onEnd: null,
        onError: function (error) {
          console.error('Could not open cursor.', error);
        }
      }, options || {});

      var directionType = options.order.toLowerCase() == 'desc' ? 'PREV' : 'NEXT';
      if (options.filterDuplicates) {
        directionType += '_NO_DUPLICATE';
      }

      var cursorTransaction = this.db.transaction([this.storeName], this.consts[options.writeAccess ? 'READ_WRITE' : 'READ_ONLY']);
      var cursorTarget = cursorTransaction.objectStore(this.storeName);
      if (options.index) {
        cursorTarget = cursorTarget.index(options.index);
      }

      var cursorRequest = cursorTarget.openCursor(options.keyRange, this.cursor[directionType]);
      cursorRequest.onerror = options.onError;
      cursorRequest.onsuccess = function (event) {
        var cursor = event.target.result;
        if (cursor) {
          callback(cursor.value, cursor, cursorTransaction);
          cursor['continue']();
        } else {
          options.onEnd && options.onEnd() || callback(null, cursor, cursorTransaction)
        }
      };
    },

    /**
     * Runs a query against the store and passes an array containing matched
     * objects to the success handler.
     *
     * @param {Function} onSuccess A callback to be called when the operation
     *  was successful.
     * @param {Object} [options] An object defining specific query options
     * @param {Object} [options.index=null] An IDBIndex to operate on
     * @param {String} [options.order=ASC] The order in which to provide the
     *  results, can be 'DESC' or 'ASC'
     * @param {Boolean} [options.filterDuplicates=false] Whether to exclude
     *  duplicate matches
     * @param {Object} [options.keyRange=null] An IDBKeyRange to use
     * @param {Function} [options.onError=console.error] A callback to be called if an error
     *  occurred during the operation.
     */
    query: function (onSuccess, options) {
      var result = [];
      options = options || {};
      options.onEnd = function () {
        onSuccess(result);
      };
      this.iterate(function (item) {
        result.push(item);
      }, options);
    },

    /**
     *
     * Runs a query against the store, but only returns the number of matches
     * instead of the matches itself.
     *
     * @param {Function} onSuccess A callback to be called if the opration
     *  was successful.
     * @param {Object} [options] An object defining specific options
     * @param {Object} [options.index=null] An IDBIndex to operate on
     * @param {Object} [options.keyRange=null] An IDBKeyRange to use
     * @param {Function} [options.onError=console.error] A callback to be called if an error
     *  occurred during the operation.
     */
    count: function (onSuccess, options) {

      options = mixin({
        index: null,
        keyRange: null
      }, options || {});

      var onError = options.onError || function (error) {
        console.error('Could not open cursor.', error);
      };

      var hasSuccess = false,
        result = null;

      var cursorTransaction = this.db.transaction([this.storeName], this.consts.READ_ONLY);
      cursorTransaction.oncomplete = function () {
        var callback = hasSuccess ? onSuccess : onError;
        callback(result);
      };
      cursorTransaction.onabort = onError;
      cursorTransaction.onerror = onError;

      var cursorTarget = cursorTransaction.objectStore(this.storeName);
      if (options.index) {
        cursorTarget = cursorTarget.index(options.index);
      }
      var countRequest = cursorTarget.count(options.keyRange);
      countRequest.onsuccess = function (evt) {
        hasSuccess = true;
        result = evt.target.result;
      };
      countRequest.onError = onError;
    },

    /**************/
    /* key ranges */
    /**************/

    /**
     * Creates a key range using specified options. This key range can be
     * handed over to the count() and iterate() methods.
     *
     * Note: You must provide at least one or both of "lower" or "upper" value.
     *
     * @param {Object} options The options for the key range to create
     * @param {*} [options.lower] The lower bound
     * @param {Boolean} [options.excludeLower] Whether to exclude the lower
     *  bound passed in options.lower from the key range
     * @param {*} [options.upper] The upper bound
     * @param {Boolean} [options.excludeUpper] Whether to exclude the upper
     *  bound passed in options.upper from the key range
     * @return {Object} The IDBKeyRange representing the specified options
     */
    makeKeyRange: function (options) {
      /*jshint onecase:true */
      var keyRange,
        hasLower = typeof options.lower != 'undefined',
        hasUpper = typeof options.upper != 'undefined';

      switch (true) {
        case hasLower && hasUpper:
          keyRange = this.keyRange.bound(options.lower, options.upper, options.excludeLower, options.excludeUpper);
          break;
        case hasLower:
          keyRange = this.keyRange.lowerBound(options.lower, options.excludeLower);
          break;
        case hasUpper:
          keyRange = this.keyRange.upperBound(options.upper, options.excludeUpper);
          break;
        default:
          throw new Error('Cannot create KeyRange. Provide one or both of "lower" or "upper" value.');
      }

      return keyRange;
    }

  };

  /** helpers **/

  var noop = function () {
  };
  var empty = {};
  var mixin = function (target, source) {
    var name, s;
    for (name in source) {
      s = source[name];
      if (s !== empty[name] && s !== target[name]) {
        target[name] = s;
      }
    }
    return target;
  };
  var hitch = function (scope, method) {
    if (!method) {
      method = scope;
      scope = null;
    }
    if (typeof method == "string") {
      scope = scope || window;
      if (!scope[method]) {
        throw(['method not found']);
      }
      return function () {
        return scope[method].apply(scope, arguments || []);
      };
    }
    return !scope ? method : function () {
      return method.apply(scope, arguments || []);
    };
  };

  return IDBStore;

}, this);
