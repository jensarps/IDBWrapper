require(['../IDBStore.js'], function(IDBStore){
	
	var tpls = {
		row: '<tr><td>{customerid}</td><td>{lastname}</td><td>{firstname}</td><td><button onclick="app.deleteItem({customerid});">delete</button></td></tr>',
		table: '<table><tr><th>ID</th><th>Last Name</th><th>First Name</th><th></th></tr>{content}</table>'
	};
	
	var customers;
	
	var nodeCache = {};
	
	function init(){
		
		// create a store ("table") for the customers
		customers = new IDBStore({
			dbName: 'appdb',
			storeName: 'customer',
			keyPath: 'customerid',
			autoIncrement: true,
			onStoreReady: updateTable
		});
		
		// create references for some nodes we have to work with
		['submit', 'customerid', 'firstname', 'lastname', 'results-container'].forEach(function(id){
			nodeCache[id] = document.getElementById(id);
		});
		
		// and listen to the form's submit button.
		nodeCache.submit.addEventListener('click', enterData);
	}
	
	function listItems(data){
		var content = '';
		data.forEach(function(item){
			content += tpls.row.replace(/\{([^\}]+)\}/g, function(_, key){
				return item[key];
			});
		});
		nodeCache['results-container'].innerHTML = tpls.table.replace('{content}', content);
	}
	
	function enterData(){
		var data = readForm();
		customers.put(data, function(){
			clearForm();
			updateTable();
		});
	}
	
	function deleteItem(id){
		customers.remove(id, updateTable);
	}
	
	function readForm(){
		var data = {};
		['customerid','firstname','lastname'].forEach(function(key){
			var value = nodeCache[key].value.trim();
			if(value.length){
				if(key == 'customerid'){ // We want the id to be numeric:
					value = ~~value;
				}
				data[key] = value;
			}
		});
		return data;
	}
	
	function clearForm(){
		['customerid','firstname','lastname'].forEach(function(id){
			nodeCache[id].value = '';
		});
	}
	
	function updateTable(){
		customers.getAll(listItems);
	}
	
	window.app = {
		deleteItem: deleteItem
	};
	
	init();
	
});