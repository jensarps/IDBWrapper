/*
 * IDBWrapper - A cross-browser wrapper for IndexedDB
 * Copyright (c) 2011 - 2013 Jens Arps
 * http://jensarps.de/
 *
 * Licensed under the MIT (X11) license
 */

"use strict";

(function (name, definition, global) {
  if (typeof define === 'function') {
    define(definition);
  } else if (typeof module !== 'undefined' && module.exports) {
    module.exports = definition();
  } else {
    global[name] = definition();
  }
})('IDBStore', function () {

  var IDBStore;

  var defaults = {
    storeName: 'Store',
    storePrefix: 'IDBWrapper-',
    dbVersion: 1,
    keyPath: 'id',
    autoIncrement: true,
    onStoreReady: function () {
    },
    onError: function(error){
      throw error;
    },
    indexes: []
  };

  IDBStore = function (kwArgs, onStoreReady) {

    for(var key in defaults){
      this[key] = typeof kwArgs[key] != 'undefined' ? kwArgs[key] : defaults[key];
    }

    this.dbName = this.storePrefix + this.storeName;
    this.dbVersion = parseInt(this.dbVersion, 10);

    onStoreReady && (this.onStoreReady = onStoreReady);

    this.idb = window.indexedDB || window.webkitIndexedDB || window.mozIndexedDB;
    this.keyRange = window.IDBKeyRange || window.webkitIDBKeyRange || window.mozIDBKeyRange;

    this.consts = {
      'READ_ONLY':         'readonly',
      'READ_WRITE':        'readwrite',
      'VERSION_CHANGE':    'versionchange',
      'NEXT':              'next',
      'NEXT_NO_DUPLICATE': 'nextunique',
      'PREV':              'prev',
      'PREV_NO_DUPLICATE': 'prevunique'
    };

    this.openDB();
  };

  IDBStore.prototype = {

    version: '0.3.2',

    db: null,

    dbName: null,

    dbVersion: null,

    store: null,

    storeName: null,

    keyPath: null,

    autoIncrement: null,

    indexes: null,

    features: null,

    onStoreReady: null,

    onError: null,

    _insertIdCount: 0,

    openDB: function () {

      var features = this.features = {};
      features.hasAutoIncrement = !window.mozIndexedDB; // TODO: Still, really?

      var openRequest = this.idb.open(this.dbName, this.dbVersion);
      var preventSuccessCallback = false;

      openRequest.onerror = function (error) {

        var gotVersionErr = false;
        if ('error' in error.target) {
          gotVersionErr = error.target.error.name == "VersionError";
        } else if ('errorCode' in error.target) {
          gotVersionErr = error.target.errorCode == 12; // TODO: Use const
        }

        if (gotVersionErr) {
          this.onError(new Error('The version number provided is lower than the existing one.'));
        } else {
          this.onError(error);
        }
      }.bind(this);

      openRequest.onsuccess = function (event) {

        if (preventSuccessCallback) {
          return;
        }

        if(this.db){
          this.onStoreReady();
          return;
        }

        this.db = event.target.result;

        if(typeof this.db.version == 'string'){
          this.onError(new Error('The IndexedDB implementation in this browser is outdated. Please upgrade your browser.'));
          return;
        }

        if(!this.db.objectStoreNames.contains(this.storeName)){
          // We should never ever get here.
          // Lets notify the user anyway.
          this.onError(new Error('Something is wrong with the IndexedDB implementation in this browser. Please upgrade your browser.'));
          return;
        }

        var emptyTransaction = this.db.transaction([this.storeName], this.consts.READ_ONLY);
        this.store = emptyTransaction.objectStore(this.storeName);

        // check indexes
        this.indexes.forEach(function(indexData){
          var indexName = indexData.name;

          if(!indexName){
            preventSuccessCallback = true;
            this.onError(new Error('Cannot create index: No index name given.'));
            return;
          }

          this.normalizeIndexData(indexData);

          if(this.hasIndex(indexName)){
            // check if it complies
            var actualIndex = this.store.index(indexName);
            var complies = this.indexComplies(actualIndex, indexData);
            if(!complies){
              preventSuccessCallback = true;
              this.onError(new Error('Cannot modify index "' + indexName + '" for current version. Please bump version number to ' + ( this.dbVersion + 1 ) + '.'));
            }
          } else {
            preventSuccessCallback = true;
            this.onError(new Error('Cannot create new index "' + indexName + '" for current version. Please bump version number to ' + ( this.dbVersion + 1 ) + '.'));
          }

        }, this);

        preventSuccessCallback || this.onStoreReady();
      }.bind(this);

      openRequest.onupgradeneeded = function(/* IDBVersionChangeEvent */ event){

        this.db = event.target.result;

        if(this.db.objectStoreNames.contains(this.storeName)){
          this.store = event.target.transaction.objectStore(this.storeName);
        } else {
          this.store = this.db.createObjectStore(this.storeName, { keyPath: this.keyPath, autoIncrement: this.autoIncrement});
        }

        this.indexes.forEach(function(indexData){
          var indexName = indexData.name;

          if(!indexName){
            preventSuccessCallback = true;
            this.onError(new Error('Cannot create index: No index name given.'));
          }

          this.normalizeIndexData(indexData);

          if(this.hasIndex(indexName)){
            // check if it complies
            var actualIndex = this.store.index(indexName);
            var complies = this.indexComplies(actualIndex, indexData);
            if(!complies){
              // index differs, need to delete and re-create
              this.store.deleteIndex(indexName);
              this.store.createIndex(indexName, indexData.keyPath, { unique: indexData.unique, multiEntry: indexData.multiEntry });
            }
          } else {
            this.store.createIndex(indexName, indexData.keyPath, { unique: indexData.unique, multiEntry: indexData.multiEntry });
          }

        }, this);

      }.bind(this);
    },

    deleteDatabase: function () {
      if (this.idb.deleteDatabase) {
        this.idb.deleteDatabase(this.dbName);
      }
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
      var deleteRequest = removeTransaction.objectStore(this.storeName)['delete'](key);
      deleteRequest.onsuccess = function (event) {
        onSuccess(event.target.result);
      };
      deleteRequest.onerror = onError;
    },

    batch: function (arr, onSuccess, onError) {
      onError || (onError = function (error) {
        console.error('Could not apply batch.', error);
      });
      onSuccess || (onSuccess = noop);
      var batchTransaction = this.db.transaction([this.storeName] , this.consts.READ_WRITE);
      var count = arr.length;
      var called = false;

      arr.forEach(function (operation) {
        var type = operation.type;
        var key = operation.key;
        var value = operation.value;

        if (type == "remove") {
          var deleteRequest = batchTransaction.objectStore(this.storeName)['delete'](key);
          deleteRequest.onsuccess = function (event) {
            count--;
            if (count == 0 && !called) {
              called = true;
              onSuccess();
            }
          };
          deleteRequest.onerror = function (err) {
            batchTransaction.abort();
            if (!called) {
              called = true;
              onError(err, type, key);
            }
          };
        } else if (type == "put") {
          if (typeof value[this.keyPath] == 'undefined' && !this.features.hasAutoIncrement) {
            value[this.keyPath] = this._getUID()
          }
          var putRequest = batchTransaction.objectStore(this.storeName).put(value);
          putRequest.onsuccess = function (event) {
            count--;
            if (count == 0 && !called) {
              called = true;
              onSuccess();
            }
          };
          putRequest.onerror = function (err) {
            batchTransaction.abort();
            if (!called) {
              called = true;
              onError(err, type, value);
            }
          };
        }
      }, this);
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
      return this._insertIdCount++ + Date.now();
    },


    /************
     * indexing *
     ************/

    getIndexList: function () {
      return this.store.indexNames;
    },

    hasIndex: function (indexName) {
      return this.store.indexNames.contains(indexName);
    },

    normalizeIndexData: function (indexData) {
      indexData.keyPath = indexData.keyPath || indexData.name;
      indexData.unique = !!indexData.unique;
      indexData.multiEntry = !!indexData.multiEntry;
    },

    indexComplies: function (actual, expected) {
      var complies = ['keyPath', 'unique', 'multiEntry'].every(function (key) {
        // IE10 returns undefined for no multiEntry
        if (key == 'multiEntry' && actual[key] === undefined && expected[key] === false) {
          return true;
        }
        return expected[key] == actual[key];
      });
      return complies;
    },

    /**********
     * cursor *
     **********/

    iterate: function (onItem, options) {
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

      var cursorRequest = cursorTarget.openCursor(options.keyRange, this.consts[directionType]);
      cursorRequest.onerror = options.onError;
      cursorRequest.onsuccess = function (event) {
        var cursor = event.target.result;
        if (cursor) {
          onItem(cursor.value, cursor, cursorTransaction);
          cursor['continue']();
        } else {
          if(options.onEnd){
            options.onEnd()
          } else {
            onItem(null);
          }
        }
      };
    },

    count: function (onSuccess, options) {

      options = mixin({
        index: null,
        keyRange: null
      }, options || {});

      var onError = options.onError || function (error) {
        console.error('Could not open cursor.', error);
      };

      var cursorTransaction = this.db.transaction([this.storeName], this.consts.READ_ONLY);
      var cursorTarget = cursorTransaction.objectStore(this.storeName);
      if (options.index) {
        cursorTarget = cursorTarget.index(options.index);
      }

      var countRequest = cursorTarget.count(options.keyRange);
      countRequest.onsuccess = function (evt) {
        onSuccess(evt.target.result);
      };
      countRequest.onError = function (error) {
        onError(error);
      };
    },

    /**************/
    /* key ranges */
    /**************/

    makeKeyRange: function(options){
      var keyRange,
          hasLower = typeof options.lower != 'undefined',
          hasUpper = typeof options.upper != 'undefined';

      switch(true){
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
          break;
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

  IDBStore.version = IDBStore.prototype.version;

  return IDBStore;

}, this);
