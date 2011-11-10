require(['../IDBStore.js'], function(IDBStore){
	var app = {
		
		tpls: {
			row: '<tr><td>{customerid}</td><td>{lastname}</td><td>{firstname}</td></tr>'
		}
		
	};
	
	console.log(IDBStore);
});