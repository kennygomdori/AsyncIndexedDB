class AsyncIndexedDB {
    // return opened database with schema definitions given.
    constructor(db_name, schema, version) {
        this.name = db_name;
        this.schema = schema; // upgrade callback
        if (version) this.version = version;
        this.db = null;
        Object.seal(this);
    }

    async open() {
        return new Promise((resolve, reject) => {
            const db_request = window.indexedDB.open(this.name, this.version);
            const schema = this.schema;
            db_request.onerror = (event) => reject(event);
            db_request.onsuccess = (event) => {
                this.db = db_request.result;
                resolve(this);
            }
            db_request.onupgradeneeded = function (event) {
                // let objectStore = this.result.createObjectStore("sandbox_saves", {keyPath: "id", autoIncrement: true});
                // objectStore.createIndex("titleIndex", "title", {unique: false});
                // objectStore.createIndex("timeIndex", "time", {unique: false});
                schema(this.result)
            };
        })
    }

    async query(objectStoreNames = this.db.objectStoreNames, oncomplete, onerror, mode = "readwrite") {
        // returns an ObjectStore proxy whose methods are awaitable.
        // e.g. await this.query().getAll()
        const transaction = this.db.transaction(objectStoreNames, mode);
        if (oncomplete instanceof Function) transaction.oncomplete = oncomplete;
        if (onerror instanceof Function) transaction.onerror = onerror;
        return this.objectStore(transaction.objectStore(objectStoreNames))
    }

    objectStore(objectStore) {
        // convert an IDBObjectStore to an ObjectStore proxy whose methods are awaitable.
        return new Proxy(objectStore, {
            get: function (obj, prop) {
                if (!(obj[prop] instanceof Function)) return obj[prop];
                if (prop === "openCursor" || prop === "openKeyCursor")
                // When a cursor supposed to be returned, return an AsyncIterable instead.
                // e.g. for await (let {key, value, primaryKey} of await this.query().openCursor()) { ... }
                    return function (...params) {
                        const request = obj[prop](...params);
                        return new Promise((resolve, reject) => {
                            request.onsuccess = e => {
                                let cursor = request.result;
                                resolve({
                                    request, cursor,
                                    [Symbol.asyncIterator]: async function* () {
                                        let promise;
                                        while (cursor = request.result) {
                                            yield {key: cursor.key, value: cursor.value, primaryKey: cursor.primaryKey};
                                            promise = new Promise((resolve, reject) => {
                                                request.onsuccess = e => resolve()
                                                request.onerror = e => reject(e);
                                            });
                                            cursor.continue();
                                            await promise;
                                        }
                                    }
                                })
                            }
                            request.onerror = e => reject(e);
                        })
                    }
                else
                // functions that do not return a cursor are just turned into Promises.
                    return function (...params) {
                        // other methods can be used as if they are simple async functions by awaiting.
                        // e.g. await this.query().getAll()
                        const request = obj[prop](...params);
                        return new Promise((resolve, reject) => {
                            request.onsuccess = e => resolve(request.result);
                            request.onerror = e => reject(e);
                        });
                    }
            },
        });
    }

    async export(query, keyRange, count) {
        // Serialize IndexedDB in [[objectStoreName1, [..objects], [objectStoreName2, [..objects], ...] that can be easily turned into a Map.
        return JSON.stringify(await Promise.all([...this.db.objectStoreNames].map(
            async objectStorename => {
                const query = await this.query(objectStorename);
                if (query.keyPath === null)
                    return [objectStorename, query.getAll(keyRange, count)]
            }
        )))
    }

    async import(data, keyPaths) {
        // Need to back up the original before import in case of error.
        // data validation may be required.
        data = JSON.parse(data);
        await Promise.all(data.map(async ([objectStoreName, entries]) => {
            let query = this.query(objectStoreName);
            if (query.keyPath === null) {
                let keyPath = keyPaths[objectStoreName];
                if (keyPath === undefined)
                    throw `ObjectStore '${query.name}' does not have a KeyPath. Call import(data, {[objectStoreName]:[keyPath]}).`
                for (let obj of entries) {
                    const key = obj[keyPath];
                    if (key !== undefined) throw `ObjectStore '${query.name}' entry '${obj}' is missing its key.`
                    await query.put(obj, key);
                }
            } else {
                for (let obj of entries) await query.put(obj);
            }
        }))
    }

    async clear() {
        return new Promise((resolve, reject) => {
            const request = window.indexedDB.deleteDatabase(this.name);
            request.onsuccess = resolve;
            request.onerror = reject;
        })
    }
}
