describe('IDBWrapper', function(){

  describe('basic CRUD', function(){

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


    after(function(done){
      store.clear(function(){
        done();
      });
    });

  });

});
