import { TTL30MINS } from './constants';

import { EVENT_TYPE } from './events/constants';

import Driver from './driver';

const driverSymbol = Symbol( 'DRIVER' );

class TimedMap {
	/**
	 * Creates an instance of TimedMap. Removes entries un-read within the previous TTL cycle. `this.get(<entry key>)` and
	 * `this.getEntry(<entry key>)` constitute valid entry read operation. To peak an entry value, use `this.peak(<entry key>)`.
	 * Please be sure to call `this.close()` method on this object prior to deleting or setting it to null.
	 *
	 * @param {number} [maxEntryAgeMillis] Default is 30 MINS in millisecs
	 * @memberof TimedMap
	 */
	constructor( maxEntryAgeMillis = TTL30MINS ) {
		this[ driverSymbol ] = new Driver( maxEntryAgeMillis );
	}

	/**
	 * all available entries.
	 *
	 * @memberof TimedMap
	 * @property
	 * @returns {MapEntry<string>[]}
	 */
	get entries() {
		return this[ driverSymbol ].entries;
	}

	/**
	 * check-flag if the map contains no entries
	 *
	 * @memberof TimedMap
	 * @property
	 */
	get isEmpty() {
		return this[ driverSymbol ].isEmpty;
	}

	/**
	 * all available keys
	 *
	 * @memberof TimedMap
	 * @property
	 */
	get keys() {
		return this[ driverSymbol ].keys;
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
		this[ driverSymbol ].events.emitNow( EVENT_TYPE.CLOSING );
		delete this[ driverSymbol ];
	}

	/**
	 * accesses value at entry key. Subsequently restarts entry's TTL cycle
	 *
	 * @memberof TimedMap
	 * @param {string} key
	 * @returns {*}
	 */
	get( key ) {
		return this[ driverSymbol ].get( key );
	}

	/**
	 * accesses entry by key. Subsequently restarts entry's TTL cycle
	 *
	 * @memberof TimedMap
	 * @param {K} key
	 * @returns {MapEntry<K>}
	 * @template {string} [K=string]
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
	 * @param {number} [ttl] in millis
	 * @returns {MapEntry<K>} existing entry
	 * @template {string} [K=string]
	 */
	put( key, value, ttl ) {
		return this[ driverSymbol ].put( key, value, ttl );
	}

	/**
	 * removes entry by key
	 *
	 * @memberof TimedMap
	 * @param {K} key
	 * @returns {MapEntry<K>} deleted entry
	 * @template {string} [K=string]
	 */
	remove( key ) {
		return this[ driverSymbol ].remove( key );
	}

	/**
	 * Cancel event by listener function reference
	 *
	 * @param {T} type
	 * @param {EventListener<T>} listener
	 * @memberof TimedMap
	 * @template {EventType} T
	 */
	off( type, listener ) {
		this[ driverSymbol ].events.off( type, listener );
	}

	/**
	 * Cancel event by eventId
	 *
	 * @param {string} eventId `${event_type}_${subscription_number}`
	 * @memberof TimedMap
	 */
	offById( eventId ) {
		this[ driverSymbol ].events.offById( eventId );
	}

	/**
	 * Subscribe to event
	 *
	 * @param {T} type
	 * @param {EventListener<T>} listener
	 * @param {Attributes} [attributes] Any additional info to attribute to this event
	 * @returns {string} eventId `${event_type}_${subscription_number}`
	 * @memberof TimedMap
	 * @template {EventType} T
	 */
	on( type, listener, attributes = {} ) {
		return this[ driverSymbol ].events.on( type, listener, attributes );
	}

	/**
	 * Subscribe to one-emit event
	 *
	 * @param {T} type
	 * @param {EventListener<T>} listener
	 * @param {Attributes} [attributes] Any additional info to attribute to this event
	 * @returns {string} eventId `${event_type}_${subscription_number}`
	 * @memberof TimedMap
	 * @template {EventType} T
	 */
	once( type, listener, attributes = {} ) {
		return this[ driverSymbol ].events.once( type, listener, attributes );
	}

	toString() {
		return 'TimedMap class';
	}
};

/** @typedef {import("./types").Attributes} Attributes */

/**
 * @typedef {(event: {type: T, data: any}) => void} EventListener
 * @template T
 */

/** @typedef {import("./events").EventType} EventType */

export default TimedMap;

/**
 * @typedef {import("./types").MapEntry<K>} MapEntry
 * @template {string} K
 */

/** @typedef {import("./types").Timeout} Timeout */
