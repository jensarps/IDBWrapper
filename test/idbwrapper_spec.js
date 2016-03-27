describe('IDBWrapper', function(){

  if (typeof window.excludeIE == 'undefined') {
    try {
      IDBKeyRange.only([1]);
      window.excludeIE = false;
    } catch (e) {
      window.excludeIE = true;
    }
  }

  console.log('Running ' + (excludeIE ? 'reduced' : 'full') + ' suite.');
  
  describe('delete databases', function(){
    var store;

    before(function(done){
      store = new IDBStore({
        stores: [{
			name: 'spec-store-simple'
		}]
      }, function () {
        done();
      });
    });

    it('should delete the newly created database', function(done){
      store.deleteDatabase(function(result){
        expect(result).to.be.ok;
        done();
      }, done);
    });

  });

  describe('basic CRUD, in-line keys', function(){

    var store, lastInsertId;

    before(function(done){
      store = new IDBStore({
        stores: [{
			name: 'spec-store-simple'
		}]
      }, done);
    });


    it('should store a well-formed object', function(done){
      var data = {
        id: 1,
        name: 'John'
      };
      store['spec-store-simple'].put(data, function(insertId){
        expect(insertId).to.equal(data.id);
        done();
      }, done);
    });

    it('should fetch a stored object', function(done){
      store['spec-store-simple'].get(1, function(data){
        expect(data.name).to.equal('John');
        done();
      }, done);
    });

    it('should overwrite a given object', function(done){
      var data = {
        id: 1,
        name: 'James'
      };
      store['spec-store-simple'].put(data, function(insertId){
        store['spec-store-simple'].get(1, function(data){
          expect(data.name).to.equal('James');
          done();
        }, done);
      }, done);
    });

    it('should store an object w/o an id', function(done){
      var data = {
        name: 'Joe'
      };
	  window.console.log('ai ' + store['spec-store-simple'].autoIncrement);
	  window.console.log('kp ' + store['spec-store-simple'].keyPath);
      store['spec-store-simple'].put(data, function(insertId){
        expect(insertId).to.exist;
        lastInsertId = insertId;
        store['spec-store-simple'].get(insertId, function(result){
          expect(result.name).to.equal(data.name);
          done();
        }, done);
      }, done);
    });

    it('should assign an id which is greater than the last assigned', function(done){
      var data = {
        name: 'John'
      };
      store['spec-store-simple'].put(data, function(insertId){
        expect(insertId).to.exist;
        expect(store.idb.cmp(insertId, lastInsertId)).to.equal(1);
        done();
      }, done);
    });

    it('should get all stored objects', function(done){
      store['spec-store-simple'].getAll(function(data){
        expect(data.length).to.equal(3);
        done();
      }, done);
    });

    it('should delete a given object', function(done){
      store['spec-store-simple'].remove(1, function(result){
        store['spec-store-simple'].get(1, function(data){
          expect(data).to.not.exist;
          done();
        }, done);
      }, done);
    });

    it('should clear all objects', function(done){
      store['spec-store-simple'].clear(function(){
        store['spec-store-simple'].getAll(function(data){
          expect(data.length).to.equal(0);
        }, done);
        done();
      }, done);
    });


    after(function(done){
      store.deleteDatabase(function(){
        done();
      });
    });

  });

  describe('basic CRUD, out-of-line keys', function(){

    var store;

    before(function(done){
      store = new IDBStore({
        stores: [{
		  name: 'spec-store-simple-out-of-line',
		  keyPath: null
		}]
      }, done);
    });


    it('should store a well-formed object', function(done){
      var data = {
        name: 'John'
      };
      var id = 1;
      store['spec-store-simple-out-of-line'].put(id, data, function(insertId){
        expect(insertId).to.equal(id);
        done();
      }, done);
    });

    it('should fetch a stored object', function(done){
      store['spec-store-simple-out-of-line'].get(1, function(data){
        expect(data.name).to.equal('John');
        done();
      }, done);
    });

    it('should overwrite a given object', function(done){
      var data = {
        name: 'James'
      };
      var id = 1;
      store['spec-store-simple-out-of-line'].put(id, data, function(insertId){
        store['spec-store-simple-out-of-line'].get(id, function(data){
          expect(data.name).to.equal('James');
          done();
        }, done);
      }, done);
    });

    it('should delete a given object', function(done){
      store['spec-store-simple-out-of-line'].remove(1, function(result){
        store['spec-store-simple-out-of-line'].get(1, function(data){
          expect(data).to.not.exist;
          done();
        }, done);
      }, done);
    });


    after(function(done){
      store.deleteDatabase(function(){
        done();
      });
    });

  });

  describe('batch ops', function(){

    var store;
    var dataArray = [
      {
        id: 1,
        name: 'John'
      },
      {
        id: 2,
        name: 'Joe'
      },
      {
        id: 3,
        name: 'James'
      }
    ];

    before(function(done){
      store = new IDBStore({
        stores: [{
		  name: 'spec-store-simple'
		}]
      }, done);
    });


    it('should store multiple objects', function(done){
      store['spec-store-simple'].putBatch(dataArray, function(result){
        expect(result).to.be.ok;
        done();
      }, done);
    });

    it('should short circuit putBatch when an empty array of items are passed and should call success', function(done) {
      store['spec-store-simple'].putBatch([], function(){
        done();
      }, function(error){
        done(new Error('Error event encountered when an empty data array is passed to putBatch.', error));
      });
    });

    it('should fetch multiple objects', function(done){
      store['spec-store-simple'].getBatch([1,2,3], function(data){
        expect(data[0].name).to.equal('John');
        expect(data[1].name).to.equal('Joe');
        expect(data[2].name).to.equal('James');
        done();
      }, done);
    });

    it('should short circuit getBatch when an empty array of keys is passed with calling success with an empty array of results', function(done) {
      store['spec-store-simple'].getBatch([], function(data){
        expect(data).to.deep.equal([]);
        done();
      }, function(error){
        done(new Error('Error event encountered when an empty key array is passed to getBatch. The error message is null and not useful.', error));
      });
    });

    it('should delete multiple objects', function(done){
      store['spec-store-simple'].removeBatch([1,2], function(result){
        expect(result).to.be.ok;
        store['spec-store-simple'].getAll(function(data){
          expect(data.length).to.equal(1);
          expect(data[0].name).to.equal('James');
        }, done);
        done();
      }, done);
    });

    it('should short circuit removeBatch when an empty array of items is passed and should call success', function(done) {
      store['spec-store-simple'].removeBatch([], function(){
        done();
      }, function(error){
        done(new Error('Error event encountered when an empty data array is passed to removeBatch.', error));
      });
    });


    after(function(done){
      store.deleteDatabase(function(){
        done();
      });
    });

  });

  describe('batch ops - upsertBatch', function () {

    var store;
    var dataArray = [
      {
        name: 'John'
      },
      {
        name: 'Joe'
      },
      {
        name: 'James'
      }
    ];

    before(function (done) {
      store = new IDBStore({
        stores: [{
		  name: 'spec-store-simple'
		}]
      }, done);
    });

    it('should store multiple objects and add keys to these objects', function (done) {
      var options = {keyField: 'foo'};
      store['spec-store-simple'].upsertBatch(dataArray, options, function (data) {
        expect(data[0].name).to.equal('John');
        expect(data[1].name).to.equal('Joe');
        expect(data[2].name).to.equal('James');
        expect(data[0].foo).to.exist;
        expect(data[1].foo).to.exist;
        expect(data[2].foo).to.exist;
        done();
      }, done);
    });

    it('should default to keyPath when assigning insertId', function (done) {
      store['spec-store-simple'].upsertBatch(dataArray, function (data) {
        expect(data[0].name).to.equal('John');
        expect(data[1].name).to.equal('Joe');
        expect(data[2].name).to.equal('James');
        expect(data[0].id).to.exist;
        expect(data[1].id).to.exist;
        expect(data[2].id).to.exist;
        done();
      }, done);
    });

    after(function (done) {
      store.deleteDatabase(function () {
        done();
      });
    });

  });

  describe('getBatch() dataArray return type', function(){

    var store;
    var dataArray = [
      {
        id: 1,
        name: 'John'
      },
      {
        id: 2,
        name: 'Joe'
      },
      {
        id: 3,
        name: 'James'
      }
    ];

    before(function(done){
      store = new IDBStore({
        stores: [{
		  name: 'spec-store-simple'
		}]
      }, function(){
        store['spec-store-simple'].putBatch(dataArray, function(){
          done();
        }, done);
      });
    });

    it('should return a sparse array for arrayType="sparse"', function(done){
      store['spec-store-simple'].getBatch([1,10,3], function(data){
        expect(data.length).to.equal(3);

        expect(data[0].name).to.equal('John');
        expect(data[1]).to.not.exist;
        expect(data[2].name).to.equal('James');

        var forEachCount = 0;
        data.forEach(function(){
          forEachCount++;
        });
        expect(forEachCount).to.equal(2);

        done();
      }, done, 'sparse');
    });

    it('should return a dense array for arrayType="dense"', function(done){
      store['spec-store-simple'].getBatch([1,10,3], function(data){
        expect(data.length).to.equal(3);

        expect(data[0].name).to.equal('John');
        expect(data[1]).to.not.exist;
        expect(data[2].name).to.equal('James');

        var forEachCount = 0;
        data.forEach(function(){
          forEachCount++;
        });
        expect(forEachCount).to.equal(3);

        done();
      }, done, 'dense');
    });

    it('should return a reduced array for arrayType="skip"', function(done){
      store['spec-store-simple'].getBatch([1,10,3], function(data){
        expect(data.length).to.equal(2);

        expect(data[0].name).to.equal('John');
        expect(data[1].name).to.equal('James');

        done();
      }, done, 'skip');
    });


    after(function(done){
      store.deleteDatabase(function(){
        done();
      });
    });

  });


  describe('indexes', function(){

    var store;

    before(function(done){

      var indexes = [
        { name: 'basic', keyPath: 'name', unique: false, multiEntry: false },
        { name: 'deep', keyPath: 'address.email', unique: false, multiEntry: false },
        { name: 'date', keyPath: 'joined', unique: false, multiEntry: false }
      ];

      if (!excludeIE) {
        indexes.push.apply(indexes, [
          { name: 'compound', keyPath: ['name', 'age'], unique: false, multiEntry: false },
          { name: 'multi', keyPath: 'pets', unique: false, multiEntry: true }
        ]);
      }

      store = new IDBStore({
        stores: [{
		  name: 'spec-store-indexes',
		  indexes: indexes
		}]
      }, done);
    });

    it('should create all indexes', function(){
      var indexList = store['spec-store-indexes'].getIndexList();
      expect(indexList).to.respondTo('contains');
      expect(indexList.length).to.equal(excludeIE ? 3 : 5);
    });

    it('should store a well-formed object', function(done){
      var data = {
        id: 1,
        name: 'John',
        lastname: 'Doe',
        age: 42,
        joined: new Date(),
        address: {
          email: 'j.doe@example.com',
          city: 'New Boston'
        },
        pets: ['cat', 'dog']
      };
      store['spec-store-indexes'].put(data, function(insertId){
        expect(insertId).to.equal(data.id);
        done();
      }, done);
    });

    after(function(done){
      store.deleteDatabase(function(){
        done();
      });
    });

  });

  describe('queries', function(){

    var store;

    before(function(done){

      var indexes = [
        { name: 'basic', keyPath: 'name', unique: false, multiEntry: false },
        { name: 'deep', keyPath: 'address.email', unique: false, multiEntry: false },
        { name: 'date', keyPath: 'joined', unique: false, multiEntry: false }
      ];

      if (!excludeIE) {
        indexes.push.apply(indexes, [
          { name: 'compound', keyPath: ['name', 'age'], unique: false, multiEntry: false },
          { name: 'multi', keyPath: 'pets', unique: false, multiEntry: true }
        ]);
      }

      store = new IDBStore({
        stores: [{
		  name: 'spec-store-indexes',
		  indexes: indexes
		}]
      }, function(){

        var dataArray = [
          {
            id: 1,
            name: 'John',
            lastname: 'Doe',
            age: 42,
            joined: Date.parse('Aug 9, 1995'),
            address: {
              email: 'j.doe@example.com',
              city: 'New Boston'
            },
            pets: ['cat', 'dog']
          },
          {
            id: 2,
            name: 'Joe',
            lastname: 'Doe',
            age: 35,
            joined: Date.parse('Sep 21, 2004'),
            address: {
              email: 'joe.doe@example.com',
              city: 'New Boston'
            },
            pets: ['dog']
          },
          {
            id: 3,
            name: 'James',
            lastname: 'Smith',
            age: 32,
            joined: Date.parse('Oct 10, 2010'),
            address: {
              email: 'j.smith@example.com',
              city: 'New York'
            },
            pets: ['dog', 'mouse', 'parrot']
          },
          {
            id: 4,
            name: 'Frank',
            lastname: 'Miller',
            age: 42,
            joined: Date.parse('Nov 27, 2001'),
            address: {
              email: 'f.miller@example.com',
              city: 'New York'
            },
            pets: ['cat', 'parrot']
          },
          {
            id: 5,
            name: 'Jenna',
            lastname: 'Doe',
            age: 43,
            joined: Date.parse('Jan 7, 2011'),
            address: {
              email: 'j.doe@example.com',
              city: 'New Boston'

            },
            pets: []
          },
          {
            id: 6,
            name: 'John',
            lastname: 'Smith',
            age: 47,
            joined: Date.parse('Feb 11, 2000'),
            address: {
              email: 'j.smith@example.com',
              city: 'New Boston'
            },
            pets: ['dog', 'parrot']
          }
        ];

        store['spec-store-indexes'].putBatch(dataArray, function(){
          done();
        });

      });
    });

    it('should fetch objects using basic index (Keyrange.only)', function(done){

      store['spec-store-indexes'].query(function(data){
        expect(data.length).to.equal(2);
        done();
      }, {
        index: 'basic',
        keyRange: store['spec-store-indexes'].makeKeyRange({
          only: 'John'
        })
      });

    });

    it('should fetch objects using basic index (Keyrange.lower)', function(done){

      store['spec-store-indexes'].query(function(data){
        expect(data.length).to.equal(3);
        done();
      }, {
        index: 'basic',
        keyRange: store['spec-store-indexes'].makeKeyRange({
          lower: 'Jo'
        })
      });

    });

    it('should fetch objects using deep index (KeyRange.only)', function(done){

      store['spec-store-indexes'].query(function(data){
        expect(data.length).to.equal(2);
        done();
      }, {
        index: 'deep',
        keyRange: store['spec-store-indexes'].makeKeyRange({
          only: 'j.doe@example.com'
        })
      });

    });

    it('should fetch objects using deep index (KeyRange.upper + exclude)', function(done){

      store['spec-store-indexes'].query(function(data){
        expect(data.length).to.equal(1);
        done();
      }, {
        index: 'deep',
        keyRange: store['spec-store-indexes'].makeKeyRange({
          upper: 'j',
          excludeUppr: true
        })
      });

    });

    it('should fetch objects using date index (KeyRange.lower)', function(done){

      store['spec-store-indexes'].query(function(data){
        expect(data.length).to.equal(5);
        done();
      }, {
        index: 'date',
        keyRange: store['spec-store-indexes'].makeKeyRange({
          lower: Date.parse('Jan 1, 2000')
        })
      });

    });

    it('should fetch objects using date index (KeyRange.upper)', function(done){

      store['spec-store-indexes'].query(function(data){
        expect(data.length).to.equal(4);
        done();
      }, {
        index: 'date',
        keyRange: store['spec-store-indexes'].makeKeyRange({
          upper: Date.parse('Jan 1, 2005')
        })
      });

    });

    it('should fetch objects using date index (KeyRange.upper + lower)', function(done){

      store['spec-store-indexes'].query(function(data){
        expect(data.length).to.equal(3);
        done();
      }, {
        index: 'date',
        keyRange: store['spec-store-indexes'].makeKeyRange({
          lower: Date.parse('Jan 1, 2000'),
          upper: Date.parse('Jan 1, 2005')
        })
      });

    });

    it('should fetch objects using compound index (KeyRange.only)', function (done) {

      if (excludeIE) {
        return done(new Error('Test skipped.'));
      }

      store['spec-store-indexes'].query(function (data) {
        expect(data.length).to.equal(1);
        done();
      }, {
        index: 'compound',
        keyRange: store['spec-store-indexes'].makeKeyRange({
          only: ['John', 42]
        })
      });

    });

    it('should fetch objects using multiEntry index (KeyRange.only)', function (done) {

      if (excludeIE) {
        return done(new Error('Test skipped.'));
      }

      store['spec-store-indexes'].query(function (data) {
        expect(data.length).to.equal(4);
        done();
      }, {
        index: 'multi',
        keyRange: store['spec-store-indexes'].makeKeyRange({
          only: 'dog'
        })
      });

    });

    it('should limit resultset, no index', function(done){

      store['spec-store-indexes'].query(function(data){
        expect(data.length).to.equal(2);
        done();
      }, {
        limit: 2
      });

    });

    it('should limit resultset, using basic index', function(done){

      store['spec-store-indexes'].query(function(data){
        expect(data.length).to.equal(2);
        expect(data[0].id).to.equal(4);
        expect(data[1].id).to.equal(3);
        done();
      }, {
        limit: 2,
        index: 'basic'
      });

    });

    it('should start with an offset, using basic index', function(done){

      store['spec-store-indexes'].query(function(data){
        expect(data.length).to.equal(4);
        expect(data[0].id).to.equal(5);
        expect(data[1].id).to.equal(2);
        done();
      }, {
        offset: 2,
        index: 'basic'
      });

    });

    it('should start with an offset and limit resultset, using basic index', function(done){

      store['spec-store-indexes'].query(function(data){
        expect(data.length).to.equal(2);
        expect(data[0].id).to.equal(1);
        expect(data[1].id).to.equal(6);
        done();
      }, {
        offset: 4,
        limit: 2,
        index: 'basic'
      });

    });

    after(function(done){
      store.deleteDatabase(function(){
        done();
      });
    });

  });

});
