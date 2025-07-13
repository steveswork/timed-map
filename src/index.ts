import { EVENT_TYPE } from './events/constants';

export { EVENT_TYPE as EventType } from './events/constants';

export type EventName = keyof typeof EVENT_TYPE;

export type KeyType = number|string|symbol;

export type Attributes = Record<KeyType, unknown>;

export type Timeout = NodeJS.Timeout;

export interface MapEntry<
	K extends KeyType = KeyType,
	V = unknown
>{
	createdAt : number; // Date in millis epoch
	key : K;
	ttl : number; // Duration in millis
	value : V;
};

export interface EventData {};

export interface AutoRenewedEventData<
	K extends KeyType = KeyType
> extends EventData {
	createdAt : number; 
	key : K;
	previouslyCreatedAt : number;
};

export interface PutEventData<
	K1 extends KeyType = KeyType,
	V1 = unknown,
	K2 extends KeyType = KeyType,
	V2 = unknown
> extends EventData {
	current : MapEntry<K1, V1>;
	previous : MapEntry<K2, V2>;
};

export interface RemovedEventData<
	K extends KeyType = KeyType,
	V = unknown
> extends EventData {
	removed : MapEntry<K, V>
};

export interface RemoveManyEventData<
	K extends KeyType = KeyType,
	V = unknown
> extends EventData {
	removed : Array<MapEntry<K, V>>
};

export interface EventDataTable<
	MAP_KEY1 extends KeyType = KeyType,
	MAP_VALUE1 = unknown,
	MAP_KEY2 extends KeyType = KeyType,
	MAP_VALUE2 = unknown
> {
	AUTO_RENEWED : AutoRenewedEventData<MAP_KEY1>;
	CLEARED : RemoveManyEventData<MAP_KEY1, MAP_VALUE1>;
	CLOSING : never;
	PRUNED : RemoveManyEventData<MAP_KEY1, MAP_VALUE1>
	PUT : PutEventData<MAP_KEY1, MAP_VALUE1, MAP_KEY2, MAP_VALUE2>
	REMOVED : RemovedEventData<MAP_KEY1, MAP_VALUE1>
};


export interface SharedEventInfo<
	E extends EventName,
	K1 extends KeyType = KeyType,
	V1 = unknown,
	K2 extends KeyType = KeyType,
	V2 = unknown
> {
	data : EventDataTable<K1, V1, K2, V2>[E];
	date : Date;
	timestamp : number;
	type : E;
}

export interface EventInfo<
	E extends EventName,
	K1 extends KeyType = KeyType,
	V1 = unknown,
	K2 extends KeyType = KeyType,
	V2 = unknown
> extends SharedEventInfo<E, K1, V1, K2, V2> {
	attributes : Attributes;
	id : string;
}

export type Listener<
	E extends EventName,
	K1 extends KeyType = KeyType,
	V1 = unknown,
	K2 extends KeyType = KeyType,
	V2 = unknown
> = (event : EventInfo<E, K1, V1, K2, V2>) => void;

import { TTL30MINS } from './constants';

import Driver from './driver';

class TimedMap<T = unknown> {

	private _driver : Driver<T>;

	/**
	 * Creates an instance of TimedMap. Removes entries un-read within the previous TTL cycle. `this.get(<entry key>)` and
	 * `this.getEntry(<entry key>)` constitute valid entry read operation. To peak an entry value, use `this.peak(<entry key>)`.
	 * Please be sure to call `this.close()` method on this object prior to deleting or setting it to null.
	 */
	constructor( maxEntryAgeMillis : number = TTL30MINS ) {
		this._driver = new Driver<T>( maxEntryAgeMillis );
	}

	/** all available entries. */
	get entries() { return this._driver.entries }

	/** check-flag if the map contains no entries */
	get isEmpty() { return this._driver.isEmpty }

	/** all available keys */
	get keys() { return this._driver.keys }

	get maxEntryAge() { return this._driver.maxEntryAge }

	/**
	 * TTL value applied to map entries. Setting this triggers adjustments in the map's internal count processes
	 */
	set maxEntryAge( maxEntryAgeMillis : number ) {
		this._driver.maxEntryAge = maxEntryAgeMillis;
	}

	/** number of entries in the map */
	get size() { return this._driver.size }

	/** removes all entries from the map */
	clear() { this._driver.clear() }

	/**
	 * Recommended pre-delete method: cleans up internal driver and
	 * system resources prior to deleting this TimeMap instance.
	 */
	close() {
		clearTimeout( this._driver.timer );
		this._driver.events.emitNow( EVENT_TYPE.CLOSING );
		delete this._driver;
	}

	/** accesses value at entry key. Subsequently restarts entry's TTL cycle */
	get( key : number ) : T;
	get( key : string ) : T;
	get( key : symbol ) : T;
	get( key ) : T { return this._driver.get( key ) }

	/** accesses entry by key. Subsequently restarts entry's TTL cycle */
	getEntry<K extends KeyType>( key : K ) : MapEntry<K, T>{
		return this._driver.getEntry( key );
	}

	/** checks if entry at key exists */
	has( key : number ) : boolean;
	has( key : string ) : boolean;
	has( key : symbol ) : boolean;
	has( key ) : boolean {
		return this._driver.has( key );
	}

	/** accesses entry value by key */
	peak( key : number ) : T;
	peak( key : string ) : T;
	peak( key : symbol ) : T;
	peak( key ) : T { return this._driver.peak( key ) }

	/** creates new map entries. Will override existing entry at key */
	put<K extends KeyType>(
		key : K,
		value : T,
		ttl? : number
	) : MapEntry<K, T> {
		return this._driver.put( key, value, ttl );
	}

	/**
	 * removes entry by key
	 * 
	 * @returns {MapEntry<K>} deleted entry
	 */
	remove<K extends KeyType>( key : K ) : MapEntry<K, T> {
		return this._driver.remove( key );
	}
	/** Cancel event by listener function reference */
	off<
		E extends EventName,
		MAP_KEY1 extends KeyType,
		MAP_VALUE1,
		MAP_KEY2 extends KeyType,
		MAP_VALUE2
	>(
		type : E,
		listener : Listener<E, MAP_KEY1, MAP_VALUE1, MAP_KEY2, MAP_VALUE2>
	) {
		this._driver.events.off( type, listener );
	}

	/**
	 * Cancel event by eventId
	 *
	 * @param {string} eventId `${event_type}_${subscription_number}`
	 */
	offById( eventId : string ) { this._driver.events.offById( eventId ) }

	/**
	 * Subscribe to event
	 *
	 * @param {Attributes} [attributes] Any additional info to attribute to this event
	 * @returns {string} eventId `${event_type}_${subscription_number}`
	 */
	on<
		E extends EventName,
		MAP_KEY1 extends KeyType,
		MAP_VALUE1,
		MAP_KEY2 extends KeyType,
		MAP_VALUE2
	>(
		type : E,
		listener : Listener<E, MAP_KEY1, MAP_VALUE1, MAP_KEY2, MAP_VALUE2>,
		attributes : Attributes = {}
	) : string {
		return this._driver.events.on( type, listener, attributes );
	}

	/**
	 * Subscribe to one-emit event
	 *
	 * @param {Attributes} [attributes] Any additional info to attribute to this event
	 * @returns {string} eventId `${event_type}_${subscription_number}`
	 */
	once<
		E extends EventName,
		MAP_KEY1 extends KeyType,
		MAP_VALUE1,
		MAP_KEY2 extends KeyType,
		MAP_VALUE2
	>(
		type : E,
		listener : Listener<E, MAP_KEY1, MAP_VALUE1, MAP_KEY2, MAP_VALUE2>,
		attributes : Attributes = {}
	) {
		return this._driver.events.once( type, listener, attributes );
	}

	toString() { return '@webKrafters/TimedMap class' }
};

export default TimedMap;
