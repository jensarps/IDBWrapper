/*global window:false, self:false, define:false, module:false */

/**
 * @license IDBWrapper - A cross-browser wrapper for IndexedDB
 * Version 1.6.2
 * Copyright (c) 2011 - 2016 Jens Arps
 * http://jensarps.de/
 *
 * Licensed under the MIT (X11) license
 */

(function(name, definition, global) {

    'use strict';

    if (typeof define === 'function') {
        define(definition);
    } else if (typeof module !== 'undefined' && module.exports) {
        module.exports = definition();
    } else {
        global[name] = definition();
    }
})('IDBStore', function() {

    'use strict';

    var defaultErrorHandler = function(error) {
        throw error;
    };
    var defaultSuccessHandler = function() {
    };

    var defaults = {
        dbName: 'IDBWrapper',
        dbVersion: 1,
        stores: [{
            name: 'Store',
            keyPath: 'id',
            autoIncrement: true,
            indexes: []
        }],
        implementationPreference: [
            'indexedDB',
            'webkitIndexedDB',
            'mozIndexedDB',
            'shimIndexedDB'
        ],
        onDbReady: function() {
        },
        onError: defaultErrorHandler
    };

    var storeDefaults = {
        name: 'Store',
        keyPath: 'id',
        autoIncrement: true,
        indexes: []
    };

    var consts = {
        'READ_ONLY': 'readonly',
        'READ_WRITE': 'readwrite',
        'VERSION_CHANGE': 'versionchange',
        'NEXT': 'next',
        'NEXT_NO_DUPLICATE': 'nextunique',
        'PREV': 'prev',
        'PREV_NO_DUPLICATE': 'prevunique'
    };

    /**
     *
     * The IDBStore constructor
     *
     * @constructor
     * @name IDBStore
     * @version 1.6.2
     *
     * @param {Object} [kwArgs] An options object used to configure the store and
     *  set callbacks
     * @param {Object} [kwArgs.stores=[ ... ] The stores
     * @param {String} [kwArgs.dbName='IDBWrapper'] The name of the database
     * @param {Number} [kwArgs.dbVersion=1] The version of the store
     * @param {String} [kwArgs.keyPath='id'] The key path to use. If you want to
     *  setup IDBWrapper to work with out-of-line keys, you need to set this to
     *  `null`
     * @param {Boolean} [kwArgs.autoIncrement=true] If set to true, IDBStore will
     *  automatically make sure a unique keyPath value is present on each object
     *  that is stored.
     * @param {Function} [kwArgs.onDbReady] A callback to be called when the
     *  DB is ready to be used.
     * @param {Function} [kwArgs.onError=throw] A callback to be called when an
     *  error occurred during instantiation of the store.
     * @param {Array} [kwArgs.indexes=[]] An array of indexData objects
     *  defining the indexes to use with the store. For every index to be used
     *  one indexData object needs to be passed in the array.
     *  An indexData object is defined as follows:
     * @param {Object} [kwArgs.indexes.indexData] An object defining the index to
     *  use
     * @param {String} kwArgs.indexes.indexData.name The name of the index
     * @param {String} [kwArgs.indexes.indexData.keyPath] The key path of the index
     * @param {Boolean} [kwArgs.indexes.indexData.unique] Whether the index is unique
     * @param {Boolean} [kwArgs.indexes.indexData.multiEntry] Whether the index is multi entry
     * @param {Array} [kwArgs.implementationPreference=['indexedDB','webkitIndexedDB','mozIndexedDB','shimIndexedDB']] An array of strings naming implementations to be used, in order or preference
     * @param {Function} [onDbReady] A callback to be called when the DB
     * is ready to be used.
     * @example
     // create a store for customers with an additional index over the
     // `lastname` property.
     var myCustomerStore = new IDBStore({
        dbVersion: 1,
        stores: [{
			'customer-index',
			keyPath: 'customerid',
			autoIncrement: true,
			indexes: [
			  { name: 'lastname', keyPath: 'lastname', unique: false, multiEntry: false }
			]
		}]
        onDbReady: populateTables,
      });
     * @example
     // create a generic store
     var myCustomerStore = new IDBStore({
        storeName: ['my-data-store'],
        onDbReady: function(){
          // start working with the stores.
        }
      });
     */
    var IDBStore = function(kwArgs, onDbReady) {

        if (typeof onDbReady == 'undefined' && typeof kwArgs == 'function') {
            onDbReady = kwArgs;
        }
        if (Object.prototype.toString.call(kwArgs) != '[object Object]') {
            kwArgs = {};
        }

        for (var key in defaults) {
            this[key] = typeof kwArgs[key] != 'undefined' ? kwArgs[key] : defaults[key];
        }

        this.dbVersion = parseInt(this.dbVersion, 10) || 1;

        onDbReady && (this.onDbReady = onDbReady);

        var env = typeof window == 'object' ? window : self;
        var availableImplementations = this.implementationPreference.filter(function(implName) {
            return implName in env;
        });
        var implementation = availableImplementations[0];
        this.idb = env[implementation];

        this.openDB();
    };

    /** @lends IDBStore.prototype */
    var proto = {

        /**
         * A pointer to the IDBStore ctor
         *
         * @private
         * @type {Function}
         * @constructs
         */
        constructor: IDBStore,

        /**
         * The version of IDBStore
         *
         * @type {String}
         */
        version: '1.6.2',

        /**
         * A reference to the IndexedDB object
         *
         * @type {Object}
         */
        db: null,

        /**
         * The full name of the IndexedDB used by IDBStore
         *
         * @type {String}
         */
        dbName: null,

        /**
         * The version of the IndexedDB used by IDBStore
         *
         * @type {Number}
         */
        dbVersion: null,

        /**
         * The stores
         *
         * @type {Array}
         */
        stores: null,

        /**
         * The callback to be called when the DB is ready to be used
         *
         * @type {Function}
         */
        onDbReady: null,

        /**
         * The callback to be called if an error occurred during instantiation
         * of the store
         *
         * @type {Function}
         */
        onError: null,

        /**
         * Opens an IndexedDB; called by the constructor.
         *
         * Will check if versions match and compare provided index configuration
         * with existing ones, and update indexes if necessary.
         *
         * Will call this.onDbReady() if everything went well and the DB
         * is ready to use, and this.onError() is something went wrong.
         *
         * @private
         *
         */
        openDB: function() {

            var openRequest = this.idb.open(this.dbName, this.dbVersion);
            var preventSuccessCallback = false;
            var remainingCallbacks = this.stores.length;

            openRequest.onerror = function(error) {

                var gotVersionErr = false;
                if ('error' in error.target) {
                    gotVersionErr = error.target.error.name == 'VersionError';
                } else if ('errorCode' in error.target) {
                    gotVersionErr = error.target.errorCode == 12;
                }

                if (gotVersionErr) {
                    this.onError(new Error('The version number provided is lower than the existing one.'));
                } else {
                    this.onError(error);
                }
            }.bind(this);

            openRequest.onsuccess = function(event) {

                if (preventSuccessCallback) {
                    return;
                }

                if (this.db) {
                    this.onDbReady();
                    return;
                }

                this.db = event.target.result;

                if (typeof this.db.version == 'string') {
                    this.onError(new Error('The IndexedDB implementation in this browser is outdated. Please upgrade your browser.'));
                    return;
                }

                for (var i = 0; i < this.stores.length; i++) {
                    if (!this.db.objectStoreNames.contains(this.stores[i].name)) {
                        // We should never ever get here.
                        // Lets notify the user anyway.
                        this.onError(new Error('Object store couldn\'t be created.'));
                        return;
                    }

                    var emptyTransaction = this.db.transaction([this.stores[i].name], consts.READ_ONLY);
                    var currentStore = new Store(this.db, this.stores[i], emptyTransaction.objectStore(this.stores[i].name));
                    this[this.stores[i].name] = currentStore;

                    // check indexes
                    var existingIndexes = Array.prototype.slice.call(currentStore.getIndexList());
                    this.stores[i].indexes && this.stores[i].indexes.forEach(handleIndexes, this);

                    if (existingIndexes.length) {
                        preventSuccessCallback = true;
                        this.onError(new Error('Cannot delete index(es) "' + existingIndexes.toString() + '" for current version. Please bump version number to ' + ( this.dbVersion + 1 ) + '.'));
                    }

                    remainingCallbacks--;
                    if (!preventSuccessCallback && remainingCallbacks === 0) {
                        this.onDbReady();
                    }
                }

				var self = this;
				function handleIndexes(indexData) {
					var indexName = indexData.name;

					if (!indexName) {
						preventSuccessCallback = true;
						self.onError(new Error('Cannot create index: No index name given.'));
						return;
					}

					currentStore.normalizeIndexData(indexData);

					if (currentStore.hasIndex(indexName)) {
						// check if it complies
						var actualIndex = currentStore.store.index(indexName);
						var complies = currentStore.indexComplies(actualIndex, indexData);
						if (!complies) {
							preventSuccessCallback = true;
							self.onError(new Error('Cannot modify index "' + indexName + '" for current version. Please bump version number to ' + ( self.dbVersion + 1 ) + '.'));
						}

						existingIndexes.splice(existingIndexes.indexOf(indexName), 1);
					} else {
						preventSuccessCallback = true;
						self.onError(new Error('Cannot create new index "' + indexName + '" for current version. Please bump version number to ' + ( self.dbVersion + 1 ) + '.'));
					}
				}

            }.bind(this);

            openRequest.onupgradeneeded = function(/* IDBVersionChangeEvent */ event) {

                this.db = event.target.result;

                for (var i = 0; i < this.stores.length; i++) {
                    var currentStore;
                    if (this.db.objectStoreNames.contains(this.stores[i].name)) {
                        currentStore = new Store(this.db, this.stores[i], event.target.transaction.objectStore(this.stores[i].name));
                        this[this.stores[i].name] = currentStore;
                    } else {
                        var optionalParameters = {autoIncrement: this.stores[i].autoIncrement ? this.stores[i].autoIncrement : storeDefaults.autoIncrement};
                        if (this.stores[i].keyPath !== null) {
                            optionalParameters.keyPath = this.stores[i].keyPath ? this.stores[i].keyPath : storeDefaults.keyPath;
                        }
						window.console.log('opt kp' + optionalParameters.keyPath);
						window.console.log('opt ai' + optionalParameters.autoIncrement);
						window.console.log('name ' + this.stores[i].name);
                        currentStore = new Store(this.db, this.stores[i], this.db.createObjectStore(this.stores[i].name, optionalParameters));
                        this[this.stores[i].name] = currentStore;
                    }

                    var existingIndexes = Array.prototype.slice.call(currentStore.getIndexList());
                    this.stores[i].indexes && this.stores[i].indexes.forEach(handleIndexes, this);

                    if (existingIndexes.length) {
                        existingIndexes.forEach(handleExistingIndexes, this);
                    }
                }
				
				var self = this;
				function handleIndexes(indexData) {
					var indexName = indexData.name;

					if (!indexName) {
						preventSuccessCallback = true;
						self.onError(new Error('Cannot create index: No index name given.'));
					}

					currentStore.normalizeIndexData(indexData);

					if (currentStore.hasIndex(indexName)) {
						// check if it complies
						var actualIndex = currentStore.store.index(indexName);
						var complies = self.stores[i].indexComplies(actualIndex, indexData);
						if (!complies) {
							// index differs, need to delete and re-create
							currentStore.store.deleteIndex(indexName);
							currentStore.store.createIndex(indexName, indexData.keyPath, {
								unique: indexData.unique,
								multiEntry: indexData.multiEntry
							});
						}

						existingIndexes.splice(existingIndexes.indexOf(indexName), 1);
					} else {
						currentStore.store.createIndex(indexName, indexData.keyPath, {
							unique: indexData.unique,
							multiEntry: indexData.multiEntry
						});
					}
				}
				
				function handleExistingIndexes(_indexName) {
					currentStore.deleteIndex(_indexName);
				}

            }.bind(this);
        },

        /**
         * Deletes the database used for this store if the IDB implementations
         * provides that functionality.
         *
         * @param {Function} [onSuccess] A callback that is called if deletion
         *  was successful.
         * @param {Function} [onError] A callback that is called if deletion
         *  failed.
         */
        deleteDatabase: function(onSuccess, onError) {
            if (this.idb.deleteDatabase) {
                this.db.close();
                var deleteRequest = this.idb.deleteDatabase(this.dbName);
                deleteRequest.onsuccess = onSuccess;
                deleteRequest.onerror = onError;
            } else {
                onError(new Error('Browser does not support IndexedDB deleteDatabase!'));
            }
        }

    };

    /** helpers **/
    var empty = {};

    function mixin(target, source) {
        var name, s;
        for (name in source) {
            s = source[name];
            if (s !== empty[name] && s !== target[name]) {
                target[name] = s;
            }
        }
        return target;
    }

    IDBStore.prototype = proto;
    IDBStore.version = proto.version;

    return IDBStore;

    /*********************
     * data manipulation *
     *********************/

    function Store(db, params, store) {
        /**
         * A reference to the objectStore used by IDBStore
         *
         * @type {Object}
         */
        this.store = null;

        /**
         * The key path
         *
         * @type {String}
         */
        this.keyPath = null;

        /**
         * Whether IDBStore uses autoIncrement
         *
         * @type {Boolean}
         */
        this.autoIncrement = null;

        /**
         * The indexes used by IDBStore
         *
         * @type {Array}
         */
        this.indexes = null;

        /**
         * The implemantations to try to use, in order of preference
         *
         * @type {Array}
         */
        this.implementationPreference = null;

        /**
         * The actual implementation being used
         *
         * @type {String}
         */
        this.implementation = '';

        /**
         * The internal insertID counter
         *
         * @type {Number}
         * @private
         */
        this._insertIdCount = 0;

        this.db = db;
        this.store = store;

        var env = typeof window == 'object' ? window : self;
        this.keyRange = env.IDBKeyRange || env.webkitIDBKeyRange || env.mozIDBKeyRange;

        for (var key in storeDefaults) {
            this[key] = typeof params[key] != 'undefined' ? params[key] : storeDefaults[key];
        }

        /**
         * Puts an object into the store. If an entry with the given id exists,
         * it will be overwritten. This method has a different signature for inline
         * keys and out-of-line keys; please see the examples below.
         *
         * @param {*} [key] The key to store. This is only needed if IDBWrapper
         *  is set to use out-of-line keys. For inline keys - the default scenario -
         *  this can be omitted.
         * @param {Object} value The data object to store.
         * @param {Function} [onSuccess] A callback that is called if insertion
         *  was successful.
         * @param {Function} [onError] A callback that is called if insertion
         *  failed.
         * @returns {IDBTransaction} The transaction used for this operation.
         * @example
         // Storing an object, using inline keys (the default scenario):
         var myCustomer = {
			  customerid: 2346223,
			  lastname: 'Doe',
			  firstname: 'John'
			};
         myCustomerStore.put(myCustomer, mySuccessHandler, myErrorHandler);
         // Note that passing success- and error-handlers is optional.
         * @example
         // Storing an object, using out-of-line keys:
         var myCustomer = {
			 lastname: 'Doe',
			 firstname: 'John'
		   };
         myCustomerStore.put(2346223, myCustomer, mySuccessHandler, myErrorHandler);
         // Note that passing success- and error-handlers is optional.
         */
        this.put = function(key, value, onSuccess, onError) {
            if (this.keyPath !== null) {
                onError = onSuccess;
                onSuccess = value;
                value = key;
            }
            onError || (onError = defaultErrorHandler);
            onSuccess || (onSuccess = defaultSuccessHandler);

            var hasSuccess = false,
                result = null,
                putRequest;

            var putTransaction = this.db.transaction([this.name], consts.READ_WRITE);
            putTransaction.oncomplete = function() {
                var callback = hasSuccess ? onSuccess : onError;
                callback(result);
            };
            putTransaction.onabort = onError;
            putTransaction.onerror = onError;

            if (this.keyPath !== null) { // in-line keys
                this._addIdPropertyIfNeeded(value);
                putRequest = putTransaction.objectStore(this.name).put(value);
            } else { // out-of-line keys
                putRequest = putTransaction.objectStore(this.name).put(value, key);
            }
            putRequest.onsuccess = function(event) {
                hasSuccess = true;
                result = event.target.result;
            };
            putRequest.onerror = onError;

            return putTransaction;
        };

        /**
         * Retrieves an object from the store. If no entry exists with the given id,
         * the success handler will be called with null as first and only argument.
         *
         * @param {*} key The id of the object to fetch.
         * @param {Function} [onSuccess] A callback that is called if fetching
         *  was successful. Will receive the object as only argument.
         * @param {Function} [onError] A callback that will be called if an error
         *  occurred during the operation.
         * @returns {IDBTransaction} The transaction used for this operation.
         */
        this.get = function(key, onSuccess, onError) {
            onError || (onError = defaultErrorHandler);
            onSuccess || (onSuccess = defaultSuccessHandler);

            var hasSuccess = false,
                result = null;

            var getTransaction = this.db.transaction([this.name], consts.READ_ONLY);
            getTransaction.oncomplete = function() {
                var callback = hasSuccess ? onSuccess : onError;
                callback(result);
            };
            getTransaction.onabort = onError;
            getTransaction.onerror = onError;
            var getRequest = getTransaction.objectStore(this.name).get(key);
            getRequest.onsuccess = function(event) {
                hasSuccess = true;
                result = event.target.result;
            };
            getRequest.onerror = onError;

            return getTransaction;
        };

        /**
         * Removes an object from the store.
         *
         * @param {*} key The id of the object to remove.
         * @param {Function} [onSuccess] A callback that is called if the removal
         *  was successful.
         * @param {Function} [onError] A callback that will be called if an error
         *  occurred during the operation.
         * @returns {IDBTransaction} The transaction used for this operation.
         */
        this.remove = function(key, onSuccess, onError) {
            onError || (onError = defaultErrorHandler);
            onSuccess || (onSuccess = defaultSuccessHandler);

            var hasSuccess = false,
                result = null;

            var removeTransaction = this.db.transaction([this.name], consts.READ_WRITE);
            removeTransaction.oncomplete = function() {
                var callback = hasSuccess ? onSuccess : onError;
                callback(result);
            };
            removeTransaction.onabort = onError;
            removeTransaction.onerror = onError;

            var deleteRequest = removeTransaction.objectStore(this.name)['delete'](key);
            deleteRequest.onsuccess = function(event) {
                hasSuccess = true;
                result = event.target.result;
            };
            deleteRequest.onerror = onError;

            return removeTransaction;
        };

        /**
         * Runs a batch of put and/or remove operations on the store.
         *
         * @param {Array} dataArray An array of objects containing the operation to run
         *  and the data object (for put operations).
         * @param {Function} [onSuccess] A callback that is called if all operations
         *  were successful.
         * @param {Function} [onError] A callback that is called if an error
         *  occurred during one of the operations.
         * @returns {IDBTransaction} The transaction used for this operation.
         */
        this.batch = function(dataArray, onSuccess, onError) {
            onError || (onError = defaultErrorHandler);
            onSuccess || (onSuccess = defaultSuccessHandler);

            if (Object.prototype.toString.call(dataArray) != '[object Array]') {
                onError(new Error('dataArray argument must be of type Array.'));
            } else if (dataArray.length === 0) {
                return onSuccess(true);
            }

            var count = dataArray.length;
            var called = false;
            var hasSuccess = false;

            var batchTransaction = this.db.transaction([this.name], consts.READ_WRITE);
            batchTransaction.oncomplete = function() {
                var callback = hasSuccess ? onSuccess : onError;
                callback(hasSuccess);
            };
            batchTransaction.onabort = onError;
            batchTransaction.onerror = onError;


            var onItemSuccess = function() {
                count--;
                if (count === 0 && !called) {
                    called = true;
                    hasSuccess = true;
                }
            };

            dataArray.forEach(function(operation) {
                var type = operation.type;
                var key = operation.key;
                var value = operation.value;

                var onItemError = function(err) {
                    batchTransaction.abort();
                    if (!called) {
                        called = true;
                        onError(err, type, key);
                    }
                };

                if (type == 'remove') {
                    var deleteRequest = batchTransaction.objectStore(this.name)['delete'](key);
                    deleteRequest.onsuccess = onItemSuccess;
                    deleteRequest.onerror = onItemError;
                } else if (type == 'put') {
                    var putRequest;
                    if (this.keyPath !== null) { // in-line keys
                        this._addIdPropertyIfNeeded(value);
                        putRequest = batchTransaction.objectStore(this.name).put(value);
                    } else { // out-of-line keys
                        putRequest = batchTransaction.objectStore(this.name).put(value, key);
                    }
                    putRequest.onsuccess = onItemSuccess;
                    putRequest.onerror = onItemError;
                }
            }, this);

            return batchTransaction;
        };

        /**
         * Takes an array of objects and stores them in a single transaction.
         *
         * @param {Array} dataArray An array of objects to store
         * @param {Function} [onSuccess] A callback that is called if all operations
         *  were successful.
         * @param {Function} [onError] A callback that is called if an error
         *  occurred during one of the operations.
         * @returns {IDBTransaction} The transaction used for this operation.
         */
        this.putBatch = function(dataArray, onSuccess, onError) {
            var batchData = dataArray.map(function(item) {
                return {type: 'put', value: item};
            });

            return this.batch(batchData, onSuccess, onError);
        };

        /**
         * Like putBatch, takes an array of objects and stores them in a single
         * transaction, but allows processing of the result values.  Returns the
         * processed records containing the key for newly created records to the
         * onSuccess calllback instead of only returning true or false for success.
         * In addition, added the option for the caller to specify a key field that
         * should be set to the newly created key.
         *
         * @param {Array} dataArray An array of objects to store
         * @param {Object} [options] An object containing optional options
         * @param {String} [options.keyField=this.keyPath] Specifies a field in the record to update
         *  with the auto-incrementing key. Defaults to the store's keyPath.
         * @param {Function} [onSuccess] A callback that is called if all operations
         *  were successful.
         * @param {Function} [onError] A callback that is called if an error
         *  occurred during one of the operations.
         * @returns {IDBTransaction} The transaction used for this operation.
         *
         */
        this.upsertBatch = function(dataArray, options, onSuccess, onError) {
            // handle `dataArray, onSuccess, onError` signature
            if (typeof options == 'function') {
                onSuccess = options;
                onError = onSuccess;
                options = {};
            }

            onError || (onError = defaultErrorHandler);
            onSuccess || (onSuccess = defaultSuccessHandler);
            options || (options = {});

            if (Object.prototype.toString.call(dataArray) != '[object Array]') {
                onError(new Error('dataArray argument must be of type Array.'));
            }

            var keyField = options.keyField || this.keyPath;
            var count = dataArray.length;
            var called = false;
            var hasSuccess = false;
            var index = 0; // assume success callbacks are executed in order

            var batchTransaction = this.db.transaction([this.name], consts.READ_WRITE);
            batchTransaction.oncomplete = function() {
                if (hasSuccess) {
                    onSuccess(dataArray);
                } else {
                    onError(false);
                }
            };
            batchTransaction.onabort = onError;
            batchTransaction.onerror = onError;

            var onItemSuccess = function(event) {
                var record = dataArray[index++];
                record[keyField] = event.target.result;

                count--;
                if (count === 0 && !called) {
                    called = true;
                    hasSuccess = true;
                }
            };

            dataArray.forEach(function(record) {
                var key = record.key;

                var onItemError = function(err) {
                    batchTransaction.abort();
                    if (!called) {
                        called = true;
                        onError(err);
                    }
                };

                var putRequest;
                if (this.keyPath !== null) { // in-line keys
                    this._addIdPropertyIfNeeded(record);
                    putRequest = batchTransaction.objectStore(this.name).put(record);
                } else { // out-of-line keys
                    putRequest = batchTransaction.objectStore(this.name).put(record, key);
                }
                putRequest.onsuccess = onItemSuccess;
                putRequest.onerror = onItemError;
            }, this);

            return batchTransaction;
        };

        /**
         * Takes an array of keys and removes matching objects in a single
         * transaction.
         *
         * @param {Array} keyArray An array of keys to remove
         * @param {Function} [onSuccess] A callback that is called if all operations
         *  were successful.
         * @param {Function} [onError] A callback that is called if an error
         *  occurred during one of the operations.
         * @returns {IDBTransaction} The transaction used for this operation.
         */
        this.removeBatch = function(keyArray, onSuccess, onError) {
            var batchData = keyArray.map(function(key) {
                return {type: 'remove', key: key};
            });

            return this.batch(batchData, onSuccess, onError);
        };

        /**
         * Takes an array of keys and fetches matching objects
         *
         * @param {Array} keyArray An array of keys identifying the objects to fetch
         * @param {Function} [onSuccess] A callback that is called if all operations
         *  were successful.
         * @param {Function} [onError] A callback that is called if an error
         *  occurred during one of the operations.
         * @param {String} [arrayType='sparse'] The type of array to pass to the
         *  success handler. May be one of 'sparse', 'dense' or 'skip'. Defaults to
         *  'sparse'. This parameter specifies how to handle the situation if a get
         *  operation did not throw an error, but there was no matching object in
         *  the database. In most cases, 'sparse' provides the most desired
         *  behavior. See the examples for details.
         * @returns {IDBTransaction} The transaction used for this operation.
         * @example
         // given that there are two objects in the database with the keypath
         // values 1 and 2, and the call looks like this:
         myStore.getBatch([1, 5, 2], onError, function (data) { … }, arrayType);

         // this is what the `data` array will be like:

         // arrayType == 'sparse':
         // data is a sparse array containing two entries and having a length of 3:
         [Object, 2: Object]
         0: Object
         2: Object
         length: 3
         __proto__: Array[0]
         // calling forEach on data will result in the callback being called two
         // times, with the index parameter matching the index of the key in the
         // keyArray.

         // arrayType == 'dense':
         // data is a dense array containing three entries and having a length of 3,
         // where data[1] is of type undefined:
         [Object, undefined, Object]
         0: Object
         1: undefined
         2: Object
         length: 3
         __proto__: Array[0]
         // calling forEach on data will result in the callback being called three
         // times, with the index parameter matching the index of the key in the
         // keyArray, but the second call will have undefined as first argument.

         // arrayType == 'skip':
         // data is a dense array containing two entries and having a length of 2:
         [Object, Object]
         0: Object
         1: Object
         length: 2
         __proto__: Array[0]
         // calling forEach on data will result in the callback being called two
         // times, with the index parameter not matching the index of the key in the
         // keyArray.
         */
        this.getBatch = function(keyArray, onSuccess, onError, arrayType) {
            onError || (onError = defaultErrorHandler);
            onSuccess || (onSuccess = defaultSuccessHandler);
            arrayType || (arrayType = 'sparse');

            if (Object.prototype.toString.call(keyArray) != '[object Array]') {
                onError(new Error('keyArray argument must be of type Array.'));
            } else if (keyArray.length === 0) {
                return onSuccess([]);
            }

            var data = [];
            var count = keyArray.length;
            var called = false;
            var hasSuccess = false;
            var result = null;

            var batchTransaction = this.db.transaction([this.name], consts.READ_ONLY);
            batchTransaction.oncomplete = function() {
                var callback = hasSuccess ? onSuccess : onError;
                callback(result);
            };
            batchTransaction.onabort = onError;
            batchTransaction.onerror = onError;

            var onItemSuccess = function(event) {
                if (event.target.result || arrayType == 'dense') {
                    data.push(event.target.result);
                } else if (arrayType == 'sparse') {
                    data.length++;
                }
                count--;
                if (count === 0) {
                    called = true;
                    hasSuccess = true;
                    result = data;
                }
            };

            keyArray.forEach(function(key) {

                var onItemError = function(err) {
                    called = true;
                    result = err;
                    onError(err);
                    batchTransaction.abort();
                };

                var getRequest = batchTransaction.objectStore(this.name).get(key);
                getRequest.onsuccess = onItemSuccess;
                getRequest.onerror = onItemError;

            }, this);

            return batchTransaction;
        };

        /**
         * Fetches all entries in the store.
         *
         * @param {Function} [onSuccess] A callback that is called if the operation
         *  was successful. Will receive an array of objects.
         * @param {Function} [onError] A callback that will be called if an error
         *  occurred during the operation.
         * @returns {IDBTransaction} The transaction used for this operation.
         */
        this.getAll = function(onSuccess, onError) {
            onError || (onError = defaultErrorHandler);
            onSuccess || (onSuccess = defaultSuccessHandler);
            var getAllTransaction = this.db.transaction([this.name], consts.READ_ONLY);
            var store = getAllTransaction.objectStore(this.name);
            if (store.getAll) {
                this._getAllNative(getAllTransaction, store, onSuccess, onError);
            } else {
                this._getAllCursor(getAllTransaction, store, onSuccess, onError);
            }

            return getAllTransaction;
        };

        /**
         * Implements getAll for IDB implementations that have a non-standard
         * getAll() method.
         *
         * @param {Object} getAllTransaction An open READ transaction.
         * @param {Object} store A reference to the store.
         * @param {Function} onSuccess A callback that will be called if the
         *  operation was successful.
         * @param {Function} onError A callback that will be called if an
         *  error occurred during the operation.
         * @private
         */
        this._getAllNative = function(getAllTransaction, store, onSuccess, onError) {
            var hasSuccess = false,
                result = null;

            getAllTransaction.oncomplete = function() {
                var callback = hasSuccess ? onSuccess : onError;
                callback(result);
            };
            getAllTransaction.onabort = onError;
            getAllTransaction.onerror = onError;

            var getAllRequest = store.getAll();
            getAllRequest.onsuccess = function(event) {
                hasSuccess = true;
                result = event.target.result;
            };
            getAllRequest.onerror = onError;
        };

        /**
         * Implements getAll for IDB implementations that do not have a getAll()
         * method.
         *
         * @param {Object} getAllTransaction An open READ transaction.
         * @param {Object} store A reference to the store.
         * @param {Function} onSuccess A callback that will be called if the
         *  operation was successful.
         * @param {Function} onError A callback that will be called if an
         *  error occurred during the operation.
         * @private
         */
        this._getAllCursor = function(getAllTransaction, store, onSuccess, onError) {
            var all = [],
                hasSuccess = false,
                result = null;

            getAllTransaction.oncomplete = function() {
                var callback = hasSuccess ? onSuccess : onError;
                callback(result);
            };
            getAllTransaction.onabort = onError;
            getAllTransaction.onerror = onError;

            var cursorRequest = store.openCursor();
            cursorRequest.onsuccess = function(event) {
                var cursor = event.target.result;
                if (cursor) {
                    all.push(cursor.value);
                    cursor['continue']();
                }
                else {
                    hasSuccess = true;
                    result = all;
                }
            };
            cursorRequest.onError = onError;
        };

        /**
         * Clears the store, i.e. deletes all entries in the store.
         *
         * @param {Function} [onSuccess] A callback that will be called if the
         *  operation was successful.
         * @param {Function} [onError] A callback that will be called if an
         *  error occurred during the operation.
         * @returns {IDBTransaction} The transaction used for this operation.
         */
        this.clear = function(onSuccess, onError) {
            onError || (onError = defaultErrorHandler);
            onSuccess || (onSuccess = defaultSuccessHandler);

            var hasSuccess = false,
                result = null;

            var clearTransaction = this.db.transaction([this.name], consts.READ_WRITE);
            clearTransaction.oncomplete = function() {
                var callback = hasSuccess ? onSuccess : onError;
                callback(result);
            };
            clearTransaction.onabort = onError;
            clearTransaction.onerror = onError;

            var clearRequest = clearTransaction.objectStore(this.name).clear();
            clearRequest.onsuccess = function(event) {
                hasSuccess = true;
                result = event.target.result;
            };
            clearRequest.onerror = onError;

            return clearTransaction;
        };

        /**
         * Checks if an id property needs to present on a object and adds one if
         * necessary.
         *
         * @param {Object} dataObj The data object that is about to be stored
         * @private
         */
        this._addIdPropertyIfNeeded = function(dataObj) {
            if (typeof dataObj[this.keyPath] == 'undefined') {
                dataObj[this.keyPath] = this._insertIdCount++ + Date.now();
            }
        };

        /************
         * indexing *
         ************/

        /**
         * Returns a DOMStringList of index names of the store.
         *
         * @return {DOMStringList} The list of index names
         */
        this.getIndexList = function() {
            return this.store.indexNames;
        };

        /**
         * Checks if an index with the given name exists in the store.
         *
         * @param {String} indexName The name of the index to look for
         * @return {Boolean} Whether the store contains an index with the given name
         */
        this.hasIndex = function(indexName) {
            return this.store.indexNames.contains(indexName);
        };

        /**
         * Normalizes an object containing index data and assures that all
         * properties are set.
         *
         * @param {Object} indexData The index data object to normalize
         * @param {String} indexData.name The name of the index
         * @param {String} [indexData.keyPath] The key path of the index
         * @param {Boolean} [indexData.unique] Whether the index is unique
         * @param {Boolean} [indexData.multiEntry] Whether the index is multi entry
         */
        this.normalizeIndexData = function(indexData) {
            indexData.keyPath = indexData.keyPath || indexData.name;
            indexData.unique = !!indexData.unique;
            indexData.multiEntry = !!indexData.multiEntry;
        };

        /**
         * Checks if an actual index complies with an expected index.
         *
         * @param {Object} actual The actual index found in the store
         * @param {Object} expected An Object describing an expected index
         * @return {Boolean} Whether both index definitions are identical
         */
        this.indexComplies = function(actual, expected) {
            var complies = ['keyPath', 'unique', 'multiEntry'].every(function(key) {
                // IE10 returns undefined for no multiEntry
                if (key == 'multiEntry' && actual[key] === undefined && expected[key] === false) {
                    return true;
                }
                // Compound keys
                if (key == 'keyPath' && Object.prototype.toString.call(expected[key]) == '[object Array]') {
                    var exp = expected.keyPath;
                    var act = actual.keyPath;

                    // IE10 can't handle keyPath sequences and stores them as a string.
                    // The index will be unusable there, but let's still return true if
                    // the keyPath sequence matches.
                    if (typeof act == 'string') {
                        return exp.toString() == act;
                    }

                    // Chrome/Opera stores keyPath squences as DOMStringList, Firefox
                    // as Array
                    if (!(typeof act.contains == 'function' || typeof act.indexOf == 'function')) {
                        return false;
                    }

                    if (act.length !== exp.length) {
                        return false;
                    }

                    for (var i = 0, m = exp.length; i < m; i++) {
                        if (!( (act.contains && act.contains(exp[i])) || act.indexOf(exp[i] !== -1) )) {
                            return false;
                        }
                    }
                    return true;
                }
                return expected[key] == actual[key];
            });
            return complies;
        };

        /**********
         * cursor *
         **********/

        /**
         * Iterates over the store using the given options and calling onItem
         * for each entry matching the options.
         *
         * @param {Function} onItem A callback to be called for each match
         * @param {Object} [options] An object defining specific options
         * @param {Object} [options.index=null] An IDBIndex to operate on
         * @param {String} [options.order=ASC] The order in which to provide the
         *  results, can be 'DESC' or 'ASC'
         * @param {Boolean} [options.autoContinue=true] Whether to automatically
         *  iterate the cursor to the next result
         * @param {Boolean} [options.filterDuplicates=false] Whether to exclude
         *  duplicate matches
         * @param {Object} [options.keyRange=null] An IDBKeyRange to use
         * @param {Boolean} [options.writeAccess=false] Whether grant write access
         *  to the store in the onItem callback
         * @param {Function} [options.onEnd=null] A callback to be called after
         *  iteration has ended
         * @param {Function} [options.onError=throw] A callback to be called
         *  if an error occurred during the operation.
         * @param {Number} [options.limit=Infinity] Limit the number of returned
         *  results to this number
         * @param {Number} [options.offset=0] Skip the provided number of results
         *  in the resultset
         * @returns {IDBTransaction} The transaction used for this operation.
         */
        this.iterate = function(onItem, options) {
            options = mixin({
                index: null,
                order: 'ASC',
                autoContinue: true,
                filterDuplicates: false,
                keyRange: null,
                writeAccess: false,
                onEnd: null,
                onError: defaultErrorHandler,
                limit: Infinity,
                offset: 0
            }, options || {});

            var directionType = options.order.toLowerCase() == 'desc' ? 'PREV' : 'NEXT';
            if (options.filterDuplicates) {
                directionType += '_NO_DUPLICATE';
            }

            var hasSuccess = false;
            var cursorTransaction = this.db.transaction([this.name], consts[options.writeAccess ? 'READ_WRITE' : 'READ_ONLY']);
            var cursorTarget = cursorTransaction.objectStore(this.name);
            if (options.index) {
                cursorTarget = cursorTarget.index(options.index);
            }
            var recordCount = 0;

            cursorTransaction.oncomplete = function() {
                if (!hasSuccess) {
                    options.onError(null);
                    return;
                }
                if (options.onEnd) {
                    options.onEnd();
                } else {
                    onItem(null);
                }
            };
            cursorTransaction.onabort = options.onError;
            cursorTransaction.onerror = options.onError;

            var cursorRequest = cursorTarget.openCursor(options.keyRange, consts[directionType]);
            cursorRequest.onerror = options.onError;
            cursorRequest.onsuccess = function(event) {
                var cursor = event.target.result;
                if (cursor) {
                    if (options.offset) {
                        cursor.advance(options.offset);
                        options.offset = 0;
                    } else {
                        var onItemReturn = onItem(cursor.value, cursor, cursorTransaction);
                        if (onItemReturn === undefined || onItemReturn) {
                            recordCount++;
                        }
                        if (options.autoContinue) {
                            if (recordCount + options.offset < options.limit) {
                                cursor['continue']();
                            } else {
                                hasSuccess = true;
                            }
                        }
                    }
                } else {
                    hasSuccess = true;
                }
            };

            return cursorTransaction;
        };

        /**
         * Runs a query against the store and passes an array containing matched
         * objects to the success handler.
         *
         * @param {Function} onSuccess A callback to be called when the operation
         *  was successful.
         * @param {Object} [options] An object defining specific options
         * @param {Object} [options.index=null] An IDBIndex to operate on
         * @param {String} [options.order=ASC] The order in which to provide the
         *  results, can be 'DESC' or 'ASC'
         * @param {Boolean} [options.filterDuplicates=false] Whether to exclude
         *  duplicate matches
         * @param {Object} [options.keyRange=null] An IDBKeyRange to use
         * @param {Function} [options.onError=throw] A callback to be called
         *  if an error occurred during the operation.
         * @param {Number} [options.limit=Infinity] Limit the number of returned
         *  results to this number
         * @param {Number} [options.offset=0] Skip the provided number of results
         *  in the resultset
         * @returns {IDBTransaction} The transaction used for this operation.
         */
        this.query = function(onSuccess, options) {
            var result = [];
            options = options || {};
            options.autoContinue = true;
            options.writeAccess = false;
            options.onEnd = function() {
                onSuccess(result);
            };
            return this.iterate(function(item) {
                result.push(item);
            }, options);
        };

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
         * @param {Function} [options.onError=throw] A callback to be called if an error
         *  occurred during the operation.
         * @returns {IDBTransaction} The transaction used for this operation.
         */
        this.count = function(onSuccess, options) {

            options = mixin({
                index: null,
                keyRange: null
            }, options || {});

            var onError = options.onError || defaultErrorHandler;

            var hasSuccess = false,
                result = null;

            var cursorTransaction = this.db.transaction([this.name], consts.READ_ONLY);
            cursorTransaction.oncomplete = function() {
                var callback = hasSuccess ? onSuccess : onError;
                callback(result);
            };
            cursorTransaction.onabort = onError;
            cursorTransaction.onerror = onError;

            var cursorTarget = cursorTransaction.objectStore(this.name);
            if (options.index) {
                cursorTarget = cursorTarget.store.index(options.index);
            }
            var countRequest = cursorTarget.store.count(options.keyRange);
            countRequest.onsuccess = function(evt) {
                hasSuccess = true;
                result = evt.target.result;
            };
            countRequest.onError = onError;

            return cursorTransaction;
        };

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
         * @param {*} [options.only] A single key value. Use this if you need a key
         *  range that only includes one value for a key. Providing this
         *  property invalidates all other properties.
         * @return {Object} The IDBKeyRange representing the specified options
         */
        this.makeKeyRange = function(options) {
            /*jshint onecase:true */
            var keyRange,
                hasLower = typeof options.lower != 'undefined',
                hasUpper = typeof options.upper != 'undefined',
                isOnly = typeof options.only != 'undefined';

            switch (true) {
                case isOnly:
                    keyRange = this.keyRange.only(options.only);
                    break;
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
                    throw new Error('Cannot create KeyRange. Provide one or both of "lower" or "upper" value, or an "only" value.');
            }

            return keyRange;

        };
    }

}, this);
