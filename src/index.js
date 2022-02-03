import isInteger from 'lodash.isinteger';

const TTL30MINS = 18e5; // in ms

const driverSymbol = Symbol( 'DRIVER' );

class Driver {
	/** @param {number} maxEntryAgeMillis */
	constructor( maxEntryAgeMillis ) {
		/** @type {number} */
		this.maxAge = (
			this.isValidTTLInput( maxEntryAgeMillis )
				? maxEntryAgeMillis
				: TTL30MINS
		);
		/** @type {{[x:string]: MapEntry<x>}} */
		this.memoObject = {};
		/** @type {NodeJS.Timeout} */
		this.timer = null;
		/** @type {number} */
		this.pruneDate = null;
	}

	get maxEntryAge() {
		return this.maxAge;
	}

	set maxEntryAge( maxEntryAgeMillis ) {
		if( !this.isValidTTLInput( maxEntryAgeMillis ) ) {
			return;
		}
		const startDate = this.pruneDate - this.maxAge;
		const currentTimeElapsed = Date.now() - startDate;
		this.maxAge = maxEntryAgeMillis;
		this.pruneDate = startDate + maxEntryAgeMillis;
		clearTimeout( this.timer );
		const timeoutDelay = this.maxAge - currentTimeElapsed;
		this.timer = setTimeout(
			() => this.prune(),
			timeoutDelay > 0 ? timeoutDelay : 0
		);
	}

	get isEmpty() {
		return !this.size;
	}

	get size() {
		return Object.keys( this.memoObject ).length;
	}

	clear() {
		if( this.isEmpty ) {
			return;
		}
		this.memoObject = {};
		this.tryResetAging();
	}

	/** @type {(key: string) => *} */
	get( key ) {
		if( !this.has( key ) ) {
			return undefined;
		}
		this.memoObject[ key ].createdAt = Date.now();
		return this.memoObject[ key ].value;
	}

	/**
	 * @type {(key: K) => MapEntry<K>}
	 * @template {string} K
	 */
	getEntry( key ) {
		return this.has( key )
			? this.memoObject[ key ]
			: undefined;
	}

	/** @type {(key: string) => boolean} */
	has( key ) {
		return key in this.memoObject;
	}

	/** @type {(ttlInput: number) => boolean} */
	isValidTTLInput( ttlInput ) {
		return isInteger( ttlInput ) &&
			this.maxAge !== ttlInput &&
			ttlInput > 0
	};

	/** @type {(key: string) => *} */
	peak( key ) {
		const entry = this.getEntry( key );
		if( entry ) {
			return entry.value;
		}
	}

	/** @type {() => void} */
	prune() {
		for( const key in this.memoObject ) {
			if( this.memoObject[ key ].createdAt <= this.pruneDate ) {
				delete this.memoObject[ key ];
			}
		}
		!this.tryResetAging() && this.tryStartAging();
	}

	/**
	 * @type {(key: K, value: *) => MapEntry<K>}
	 * @template {string} K
	 */
	put( key, value ) {
		const exEntry = this.getEntry( key );
		this.memoObject[ key ] = {
			createdAt: Date.now(), key, value
		};
		this.size === 1 && this.tryStartAging();
		return exEntry;
	}

	/**
	 * @type {(key: K) => MapEntry<K>}
	 * @template {string} K
	 */
	remove( key ) {
		const exEntry = this.memoObject[ key ];
		if( !exEntry ) {
			return;
		}
		delete this.memoObject[ key ];
		this.tryResetAging();
		return exEntry;
	}

	/** @type {() => boolean} */
	tryResetAging() {
		if( !this.isEmpty ) {
			return false;
		}
		clearTimeout( this.timer );
		this.pruneDate = null;
		return true;
	}

	/** @type {() => boolean} */
	tryStartAging() {
		if( this.isEmpty ) {
			return false;
		}
		clearTimeout( this.timer );
		this.pruneDate = Date.now() + this.maxAge;
		this.timer = setTimeout(
			() => this.prune(),
			this.maxAge
		);
		return true;
	}
};

class TimedMap {
	/**
	 * Creates an instance of TimedMap. Removes entries un-read within the previous TTL cycle. `this.get(<entry key>)`
	 * constitutes an entry read. To peak an entry value, use `this.peak(<entry key>)`. Please be sure to call `this.close()`
	 * method on this object prior to deleting or setting it to null.
	 *
	 * @param {number} [maxEntryAgeMillis] Default is 30 MINS in millisecs
	 * @memberof TimedMap
	 */
	constructor( maxEntryAgeMillis = TTL30MINS ) {
		this[ driverSymbol ] = new Driver( maxEntryAgeMillis );
	}

	/**
	 * all available entries
	 *
	 * @memberof TimedMap
	 * @property
	 * @readonly
	 */
	get entries() {
		return Object.values( this[ driverSymbol ].memoObject );
	}

	/**
	 * check-flag if the map contains no entries
	 *
	 * @memberof TimedMap
	 * @property
	 * @readonly
	 */
	get isEmpty() {
		return this[ driverSymbol ].isEmpty;
	}

	/**
	 * all available keys
	 *
	 * @memberof TimedMap
	 * @property
	 * @readonly
	 */
	get keys() {
		return Object.keys( this[ driverSymbol ].memoObject );
	}

	get maxEntryAge() {
		return this[ driverSymbol ].maxEntryAge;
	}

	/**
	 * TTL value applied to map entries. Setting this triggers adjustments in the map's internal count processes
	 *
	 * @memberof TimedMap
	 * @property
	 * @public
	 */
	set maxEntryAge( maxEntryAgeMillis ) {
		this[ driverSymbol ].maxEntryAge = maxEntryAgeMillis;
	}

	/**
	 * number of entries in the map
	 *
	 * @memberof TimedMap
	 * @property
	 * @readonly
	 */
	get size() {
		return this[ driverSymbol ].size;
	}

	/**
	 * removes all entries from the map
	 *
	 * @memberof TimedMap
	 */
	clear() {
		this[ driverSymbol ].clear();
	}

	/**
	 * Recommended pre-delete method: cleans up internal driver and
	 * system resources prior to deleting this TimeMap instance.
	 *
	 * @memberof TimedMap
	 */
	close() {
		clearTimeout( this[ driverSymbol ].timer );
		delete this[ driverSymbol ];
	}

	/**
	 * accesses value at entry key. Subsequently restarts entry's TTL timer
	 *
	 * @memberof TimedMap
	 * @param {string} key
	 * @returns {*}
	 */
	get( key ) {
		return this[ driverSymbol ].get( key );
	}

	/**
	 * accesses entry by key
	 *
	 * @memberof TimedMap
	 * @param {K} key
	 * @returns {MapEntry<K>}
	 * @template {string} K
	 */
	getEntry( key ) {
		return this[ driverSymbol ].getEntry( key );
	}

	/**
	 * checks if entry at key exists
	 *
	 * @memberof TimedMap
	 * @param {string} key
	 * @returns {boolean}
	 */
	has( key ) {
		return this[ driverSymbol ].has( key );
	}

	/**
	 * accesses entry value by key
	 *
	 * @memberof TimedMap
	 * @param {string} key
	 * @returns {*}
	 */
	peak( key ) {
		return this[ driverSymbol ].peak( key );
	}

	/**
	 * creates new map entries. Will override existing entry at key
	 *
	 * @memberof TimedMap
	 * @param {K} key
	 * @param {*} value
	 * @returns {MapEntry<K>} existing entry
	 * @template {string} K
	 */
	put( key, value ) {
		return this[ driverSymbol ].put( key, value );
	}

	/**
	 * removes entry by key
	 *
	 * @memberof TimedMap
	 * @param {K} key
	 * @returns {MapEntry<K>} deleted entry
	 * @template {string} K
	 */
	remove( key ) {
		return this[ driverSymbol ].remove( key );
	}
};

export default TimedMap;

/**
 * @typedef {Object} MapEntry
 * @property {number} MapEntry.createdAt //Date in millis epoch
 * @property {K} MapEntry.key
 * @property {*} MapEntry.value
 * @template {string} K
 */
/** @typedef {NodeJS.Timeout} Timeout */
