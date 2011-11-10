require(['../IDBStore.js'], function(IDBStore){
	
	var tpls = {
		row: '<tr><td>{customerid}</td><td>{lastname}</td><td>{firstname}</td><td><button onclick="app.deleteItem({typedcustomerid});">delete</button></td></tr>',
		table: '<table><tr><th>Customer ID</th><th>Last Name</th><th>First Name</th></tr>{content}</table>'
	};
	
	var customers;
	
	var nodeCache = {};
	
	function init(){
		
		customers = new IDBStore({
			dbName: this.dbName,
			storeName: 'customer',
			keyPath: 'customerid',
			autoIncrement: true,
			onStoreReady: updateTable
		});
		
		['submit', 'customerid', 'firstname', 'lastname', 'results-container'].forEach(function(id){
			nodeCache[id] = document.getElementById(id);
		});
		nodeCache.submit.addEventListener('click', enterData);
	}
	
	function listItems(data){
		var content = '';
		data.forEach(function(item){
			item.typedcustomerid = typeof item.customerid == 'string' ? "'" + item.customerid.trim() + "'" : item.customerid;
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
		['customerid','firstname','lastname'].forEach(function(id){
			var value = nodeCache[id].value.trim();
			if(value.length){
				data[id] = value;
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