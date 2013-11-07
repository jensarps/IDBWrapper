describe('IDBWrapper', function(){

  describe('basic CRUD, in-line keys', function(){

    var store;

    before(function(done){
      store = new IDBStore({
        storeName: 'spec-store-simple'
      }, done);
    });


    it('should store a well-formed object', function(done){
      var data = {
        id: 1,
        name: 'John'
      };
      store.put(data, function(insertId){
        expect(insertId).to.equal(data.id);
        done();
      }, done);
    });

    it('should fetch a stored object', function(done){
      store.get(1, function(data){
        expect(data.name).to.equal('John');
        done();
      }, done);
    });

    it('should overwrite a given object', function(done){
      var data = {
        id: 1,
        name: 'James'
      };
      store.put(data, function(insertId){
        store.get(1, function(data){
          expect(data.name).to.equal('James');
          done();
        }, done);
      }, done);
    });

    it('should store an object w/o an id', function(done){
      var data = {
        name: 'Joe'
      };
      store.put(data, function(insertId){
        expect(insertId).to.exist;
        store.get(insertId, function(result){
          expect(result.name).to.equal(data.name);
          done();
        }, done);
      }, done);
    });

    it('should get all stored objects', function(done){
      store.getAll(function(data){
        expect(data.length).to.equal(2);
        done();
      }, done);
    });

    it('should delete a given object', function(done){
      store.remove(1, function(result){
        store.get(1, function(data){
          expect(data).to.not.exist;
          done();
        }, done);
      }, done);
    });

    it('should clear all objects', function(done){
      store.clear(function(){
        store.getAll(function(data){
          expect(data.length).to.equal(0);
        }, done);
        done();
      }, done);
    });


    after(function(done){
      store.clear(function(){
        done();
      });
    });

  });

  describe('basic CRUD, out-of-line keys', function(){

    var store;

    before(function(done){
      store = new IDBStore({
        storeName: 'spec-store-simple-out-of-line',
        keyPath: null
      }, done);
    });


    it('should store a well-formed object', function(done){
      var data = {
        name: 'John'
      };
      var id = 1;
      store.put(id, data, function(insertId){
        expect(insertId).to.equal(id);
        done();
      }, done);
    });

    it('should fetch a stored object', function(done){
      store.get(1, function(data){
        expect(data.name).to.equal('John');
        done();
      }, done);
    });

    it('should overwrite a given object', function(done){
      var data = {
        name: 'James'
      };
      var id = 1;
      store.put(id, data, function(insertId){
        store.get(id, function(data){
          expect(data.name).to.equal('James');
          done();
        }, done);
      }, done);
    });

    it('should delete a given object', function(done){
      store.remove(1, function(result){
        store.get(1, function(data){
          expect(data).to.not.exist;
          done();
        }, done);
      }, done);
    });


    after(function(done){
      store.clear(function(){
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
        storeName: 'spec-store-simple'
      }, done);
    });


    it('should store multiple objects', function(done){
      store.putBatch(dataArray, function(result){
        expect(result).to.be.ok;
        done();
      }, done);
    });

    it('should fetch multiple objects', function(done){
      store.getBatch([1,2,3], function(data){
        expect(data[0].name).to.equal('John');
        expect(data[1].name).to.equal('Joe');
        expect(data[2].name).to.equal('James');
        done();
      }, done);
    });

    it('should delete multiple objects', function(done){
      store.removeBatch([1,2], function(result){
        expect(result).to.be.ok;
        store.getAll(function(data){
          expect(data.length).to.equal(1);
          expect(data[0].name).to.equal('James');
        }, done);
        done();
      }, done);
    });


    after(function(done){
      store.clear(function(){
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
        storeName: 'spec-store-simple'
      }, function(){
        store.putBatch(dataArray, function(){
          done();
        }, done);
      });
    });

    it('should return a sparse array for arrayType="sparse"', function(done){
      store.getBatch([1,10,3], function(data){
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
      store.getBatch([1,10,3], function(data){
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
      store.getBatch([1,10,3], function(data){
        expect(data.length).to.equal(2);

        expect(data[0].name).to.equal('John');
        expect(data[1].name).to.equal('James');

        done();
      }, done, 'skip');
    });


    after(function(done){
      store.clear(function(){
        done();
      });
    });

  });


  describe('indexes', function(){

    var store;

    before(function(done){
      store = new IDBStore({
        storeName: 'spec-store-indexes',
        indexes: [
          { name: 'basic', keyPath: 'name', unique: false, multiEntry: false },
          { name: 'deep', keyPath: 'address.email', unique: false, multiEntry: false },
          { name: 'date', keyPath: 'joined', unique: false, multiEntry: false },
          { name: 'compound', keyPath: ['name', 'age'], unique: false, multiEntry: false }
        ]
      }, done);
    });

    it('should create all indexes', function(){
      var indexList = store.getIndexList();
      expect(indexList).to.respondTo('contains');
      expect(indexList.length).to.equal(4);
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
        }
      };
      store.put(data, function(insertId){
        expect(insertId).to.equal(data.id);
        done();
      }, done);
    });

    after(function(done){
      store.clear(function(){
        done();
      });
    });

  });


});
