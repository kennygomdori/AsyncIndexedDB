# AsyncIndexedDB
A simple, asynchronous wrapper around Javascript IndexedDB. Less than 6kb un-minified. Simplify your IndexedDB code. It's the better way to use IndexedDB.


### Features

- Replace the verbose, event-based IndexedDB API with asynchronous methods.
- Better error handlling with try, catch instead of callbacks.
- Provides a simple way to locally store structured data including large files and blobs.
- Largely reserves the original IndexedDB API. No need to re-learn the API.
- ObjectStore methods that return an IDBCursor return a simple AsyncIterator instead, making iterating over query results easy. See below for examples.
- Compatible with all major browsers.



## API

### class **AsyncIndexedDB**(db_name: str, schema: Function, version: Int)
Create a IndexedDB with *db_name* , and the *schema*, the *version* number. *version* is a positive integer.
#### *async* open()
Initializes the database by opening and applying its *schema* if the database is new, or the *version* has increased.
#### query(objectStoreNames: Array = this.db.objectStoreNames, mode = "readwrite", oncomplete: Function, onerror: Function)
Opens a transaction, and creates a ObjectStore proxy. Mode can be either "readwrite" or "readonly". *oncomplete* and *onerror* are called when transaction succeeds and when it fails, respectively. The proxy has all the properties and methods of the original IDBObjectStore, but the asynchronous equivalents in place of the event-based methods.

#### *async* import(data: Array)
Import data into the IndexedDB. The data needs to be in a form of nested arrays. `[[objectStoreName1, [..records], keyPath1], [objectStoreName2, [..records], keyPath2], ...]`. *keyPath* is required for every objectStore without a fixed keyPath defined.

#### *async* export(keyRange: Array, count: Int)
Serialize IndexedDB into a nested array form: `[[objectStoreName1, [..records], keyPath1], [objectStoreName2, [..records], keyPath2], ...]`
that can be easily turned into a Map. If keyRange and/or count are defined, they are used together to form a query, and only the resulting records will be exported. If both are undefined, the entire DB will be exported.



## Comparison with IndexedDB

These are simple examples, and the difference in code complexity will only increase with proper error handling and data processing.

#### IndexedDB

```javascript
// Open database "blog" with version 1.
let DBOpenRequest = window.indexedDB.open("blog", 1);

// error
DBOpenRequest.onerror = function (event) {
    console.log('failed to open db')
};

let db;
DBOpenRequest.onsuccess = function (event) {
    // store the result of opening the database in the db
    db = DBOpenRequest.result;
    success_callback(db);
};

// Data definition if a version upgrade is needed.
DBOpenRequest.onupgradeneeded = function (event) {
    const db = event.target.result;
    db.onerror = function (event) {
        console.log('Error loading database.');
    };
    const objectStore = db.createObjectStore("blog_posts", {keyPath: "id", autoIncrement: true});
    objectStore.createIndex("titleIndex", "title", {unique: false});
    objectStore.createIndex("timeIndex", "time", {unique: false});
};

// put (insert/update) a row into the objectStore (IndexedDB-equivalent of Table)
function success_callback(db) {
    let transaction = db.transaction('blog_posts', 'readwrite');
    let objectStore = transaction.objectStore('blog_posts');
    let request = objectStore.put({
        id: 1,
        title: "sample title",
        time: Date.now(),
        data: "empty body"
    });
    request.onsuccess = function () {
        let request = objectStore.getAll();
        request.onsuccess = function () {
            for (let record of request.result) {
                console.log(record);
            }
        }
    };
    request.onerror = console.log;
    // do the same thing again using an IDBCursor.
    request = objectStore.openCursor();
    request.onsuccess = function (event) {
        const cursor = event.target.result;
        while (cursor) {
            console.log(cursor.value);
            cursor.continue();
        }
    };
}
```

#### AsyncIndexedDB

```javascript
// The data definition schema. The schema is called when the old database version needs to be upgraded.
const schema = async (db) => {
	const objectStore = db.createObjectStore("blog_posts", {keyPath: "id", autoIncrement: true});
	objectStore.createIndex("titleIndex", "title", {unique: false});
	objectStore.createIndex("timeIndex", "time", {unique: false});
	};

// create a database named "blog", and a schema defining function, and a version number.
const db = new AsyncIndexedDB("blog",  schema, 1);

// initialize the database.
await db.open();

// put (insert/update) a record (row) into the objectStore (IndexedDB-equivalent of Table)

const query = db.query('blog_posts')
await query.put({
	id: 1,
	title: 'title',
	time: Date.now(),
	data: 'body'
});

// get all records and iterate over them.
for (let record of await query.getAll()) {
	console.log(record);
}

const cursor = await query.openCursor();

// get a cursor and iterate over the objectStore in another thread.
for await (let {value} of cursor) {
	console.log(value)
}
```

## References

[IDBDatabase W3C Recommendation](https://www.w3.org/TR/IndexedDB/)

[Using IDBDDatabase MDN](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB)

