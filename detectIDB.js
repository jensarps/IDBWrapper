(function (name, definition, global) {
  if (typeof define === 'function') {
    define(definition);
  } else if (typeof module !== 'undefined' && module.exports) {
    module.exports = definition();
  } else {
    global[name] = definition();
  }
})('detectIDB', function () {

  var detectIDB = function (onResult, dbName) {
    if (typeof onResult != 'function') {
      throw new Error('No result handler given.');
    }
    dbName = dbName || '__detectIDB_test';

    var env = typeof window == 'object' ? window : self;
    var idb = env.indexedDB || env.webkitIndexedDB || env.mozIndexedDB;
    var keyRange = env.IDBKeyRange || env.webkitIDBKeyRange || env.mozIDBKeyRange;

    // IE detection idea found at http://stackoverflow.com/a/26779525
    try {
      keyRange.only([1]);
    } catch (e) {
      onResult(detectIDB.IE);
      return;
    }

    // Safari detection by Nolan Lawson: http://bl.ocks.org/nolanlawson/raw/c83e9039edf2278047e9/
    var openReuqest = idb.open(dbName, 1);

    openReuqest.onupgradeneeded = function (evt) {
      var db = evt.target.result;
      db.createObjectStore('one', {
        keyPath: 'key'
      });
      db.createObjectStore('two', {
        keyPath: 'key'
      });
    };

    openReuqest.onsuccess = function (evt) {
      var db = evt.target.result;
      var transaction;
      try {
        transaction = db.transaction(['one', 'two'], 'readwrite');
      } catch (e) {
        onResult(detectIDB.SAFARI);
        return;
      }

      transaction.oncomplete = function () {
        db.close();
        onResult(detectIDB.COMPATIBLE);
      };
    };
  };

  detectIDB.COMPATIBLE = 'compatible';
  detectIDB.IE = 'IE';
  detectIDB.SAFARI = 'Safari';

  return detectIDB;

}, this);
