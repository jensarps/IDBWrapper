/*
 * IDBWrapper - A cross-browser wrapper for IndexedDB
 * Copyright (c) 2011 - 2012 Jens Arps
 * http://jensarps.de/
 *
 * Licensed under the MIT (X11) license
 */

"use strict";

(function (name, definition, global) {
  if (typeof define === 'function') {
    define(definition);
  } else {
    global[name] = definition();
  }
})('IDBStore', function () {

  var IDBStore;

  var defaults = {
    storeName: 'Store',
    dbVersion: 1,
    keyPath: 'id',
    autoIncrement: true,
    onStoreReady: function () {
    },
    indexes: []
  };

  IDBStore = function (kwArgs, onStoreReady) {

    function fixupConstants (object, constants) {
      for (var prop in constants) {
        if (!(prop in object))
          object[prop] = constants[prop];
      }
    }

    for(var key in defaults){
      this[key] = typeof kwArgs[key] != 'undefined' ? kwArgs[key] : defaults[key];
    }

    this.dbName = 'IDBWrapper-' + this.storeName;
    this.dbVersion = parseInt(this.dbVersion, 10);

    onStoreReady && (this.onStoreReady = onStoreReady);

    this.idb = window.indexedDB || window.webkitIndexedDB || window.mozIndexedDB;
    this.keyRange = window.IDBKeyRange || window.webkitIDBKeyRange || window.mozIDBKeyRange;

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

    dbVersion: null,

    store: null,

    storeName: null,

    keyPath: null,

    autoIncrement: null,

    indexes: null,

    features: null,

    onStoreReady: null,

    openDB: function () {

      this.newVersionAPI = typeof this.idb.setVersion == 'undefined';

      if(!this.newVersionAPI){
        throw new Error('The IndexedDB implementation in this browser is outdated. Please upgrade your browser.');
      }

      var features = this.features = {};
      features.hasAutoIncrement = !window.mozIndexedDB; // TODO: Still, really?

      var openRequest = this.idb.open(this.dbName, this.dbVersion);

      openRequest.onerror = function (error) {

        var gotVersionErr = false;
        if ('error' in error.target) {
          gotVersionErr = error.target.error.name == "VersionError";
        } else if ('errorCode' in error.target) {
          gotVersionErr = error.target.errorCode == 12; // TODO: Use const
        }

        if (gotVersionErr) {
          console.log('Version error');
        } else {
          console.error('Could not open database, error', error);
        }
      }.bind(this);


      openRequest.onsuccess = function (event) {

        if(this.db){
          this.onStoreReady();
          return;
        }

        this.db = event.target.result;

        if(this.db.objectStoreNames.contains(this.storeName)){
          console.log('object store found');
          if(!this.store){
            this.store = this.openExistingObjectStore();
          }
          // check indexes

          this.indexes.forEach(function(indexData){
            var indexName = indexData.name;

            // normalize and provide existing keys
            indexData.keyPath = indexData.keyPath || indexName;
            indexData.unique = !!indexData.unique;
            indexData.multiEntry = !!indexData.multiEntry;

            if(!indexName){
              throw new Error('Cannot create index: No index name given.');
            }

            if(this.hasIndex(indexName)){
              // check if it complies
              var actualIndex = this.store.index(indexName);
              var complies = ['keyPath', 'unique', 'multiEntry'].every(function(key){
                return indexData[key] == actualIndex[key];
              });
              if(!complies){
                throw new Error('Cannot modify index "' + indexName + '" for current version. Please bump version number to ' + ( this.dbVersion + 1 ) + '.');
              }
            } else {
              throw new Error('Cannot create new index "' + indexName + '" for current version. Please bump version number to ' + ( this.dbVersion + 1 ) + '.');
            }

          }, this);

          this.onStoreReady();
        } else {
          // We should never get here.
          throw new Error('Cannot create a new store for current version. Please bump version number to ' + ( this.dbVersion + 1 ) + '.');
        }
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

          // normalize and provide existing keys
          indexData.keyPath = indexData.keyPath || indexName;
          indexData.unique = !!indexData.unique;
          indexData.multiEntry = !!indexData.multiEntry;

          if(!indexName){
            throw new Error('Cannot create index: No index name given.');
          }

          if(this.hasIndex(indexName)){
            // check if it complies
            var actualIndex = this.store.index(indexName);
            var complies = ['keyPath', 'unique', 'multiEntry'].every(function(key){
              return indexData[key] == actualIndex[key];
            });
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

    /*************************
     * object store handling *
     *************************/

    openExistingObjectStore: function () {
      var emptyTransaction = this.db.transaction([this.storeName], this.consts.READ_ONLY);
      var store = emptyTransaction.objectStore(this.storeName);
      emptyTransaction.abort();

      return store;
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

    getIndexList: function () {
      return this.store.indexNames;
    },

    hasIndex: function (indexName) {
      return this.store.indexNames.contains(indexName);
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

  return IDBStore;

}, this);
