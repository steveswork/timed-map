export interface EventArgsTable<
	K1 extends KeyType = KeyType,
	V1 = unknown,
	K2 extends KeyType = KeyType,
	V2 = unknown
>{
	AUTO_RENEWED : [K1, number, number];
	CLEARED : [Array<MapEntry<K1, V1>>];
	CLOSING : [];
	PRUNED : [Array<MapEntry<K1, V1>>];
	PUT : [MapEntry<K1, V1>, MapEntry<K2, V2>];
	REMOVED : [MapEntry<K1, V1>];
};

export interface ListenerInfo<
	E extends EventName,
	K1 extends KeyType = KeyType,
	V1 = unknown,
	K2 extends KeyType = KeyType,
	V2 = unknown
>{
	attributes : Attributes;
	id : string;  // Event ID in format: `${event_type}@@@${subscription_number}`
	listen : Listener<E, K1, V1, K2, V2>;
	once? : boolean;
};

export type ListenerRunner<
	E extends EventName,
	K1 extends KeyType = KeyType,
	V1 = unknown,
	K2 extends KeyType = KeyType,
	V2 = unknown
> = ( listener: ListenerInfo<E, K1, V1, K2, V2> ) => void;

export type EventBus<
	E extends EventName,
	K1 extends KeyType = KeyType,
	V1 = unknown,
	K2 extends KeyType = KeyType,
	V2 = unknown
> = {
	[eventId : string] : ListenerInfo<E, K1, V1, K2, V2>
};

export type ListenerInfoContainer = {[E in EventName] : EventBus<E>};

import cloneDeep from 'lodash.clonedeep';
import isObject from 'lodash.isobject';

import {
	Attributes,
	EventDataTable,
	EventName,
	KeyType,
	Listener,
	MapEntry,
	SharedEventInfo
} from '../';

import {
	DELIMITER,
	EVENT_TYPE as TYPE,
	EventTypes
} from './constants';

const SCHEDULED_EMIT_WARNING = ( str, eventId ) => `\
Issues communicating event ID  ${ eventId }. \
If dealing with objects going out of scope, please consider using the \`emitNow\` method.\
`;

const INVALID_TYPE_ERROR_MSG = ( str, type ) => `\
Invalid event type: ${ type }. Valid event types are: [${ EventTypes.join( ', ') }]\
`;

const REF_ERROR_PATTERN = /^[Cc]annot\s+set\s+property\s+.+\s+of\s+undefined$/;

class Events {

	private _entryCounter = 0;

	private _listeners : ListenerInfoContainer;

	/** Creates an instance of Event type buckets */
	constructor() {
		this._listeners = Object.seal(
			EventTypes.reduce(( o, v ) => {
				o[ v ] = {};
				return o;
			}, {})
		) as ListenerInfoContainer;
	}	

	/** Schedules events to run immediately at the completion of previously scheduled tasks. */
	emit<
		E extends EventName,
		K1 extends KeyType,
		V1,
		K2 extends KeyType,
		V2
	>( type : E, ...args : EventArgsTable<K1, V1, K2, V2>[E] ) : void {
		const eventData = this._calcSharedData( type, args  );
		if( typeof eventData === 'undefined' ) { return }
		const listeners = cloneDeep( this._listeners[ type ] );
		for( const k in listeners ) {
			if( listeners[ k ].once ) {
				delete this._listeners[ type ][ k ];
			}
		}
		setTimeout(
			() => Object
				.values( listeners )
				.forEach(
					getListenerRunner( eventData ),
					0
				)
		);
	}

	/** Runs events immediately */
	emitNow<
		E extends EventName,
		K1 extends KeyType,
		V1,
		K2 extends KeyType,
		V2
	>( type : E, ...args : EventArgsTable<K1, V1, K2, V2>[E] ) : void {
		const eventData = this._calcSharedData( type, args );
		if( typeof eventData === 'undefined' ) { return }
		const listeners = this._listeners[ type ];
		const run = getListenerRunner( eventData );
		for( const k in listeners ) {
			run( listeners[ k ] );
			// istanbul ignore next
			if( listeners[ k ].once ) {
				delete this._listeners[ type ][ k ];
			}
		}
	}

	/** Cancel event by listener function reference */
	off<
		E extends EventName,
		K1 extends KeyType,
		V1,
		K2 extends KeyType,
		V2
	>(
		type : E,
		listener : Listener<E, K1, V1, K2, V2>
	) : void {
		const eventGroup = this._listeners[ type ];
		const entryNumber = Object.keys( eventGroup ).find(
			k => eventGroup[ k ].listen === listener
		);
		if( typeof entryNumber !== 'undefined' ) {
			delete this._listeners[ type ][ entryNumber ];
		}
	}

	/**
	 * Cancel event by eventId
	 *
	 * @param {string} eventId `${event_type}_${subscription_number}`
	 */
	offById( eventId : string ) {
		const [ type, entryNumber ] = eventId.split( DELIMITER );
		delete this._listeners[ type ][ entryNumber ];
	}

	/**
	 * Subscribe to event
	 *
	 * @param {Attributes} [attributes] Any additional info to attribute to this event
	 * @returns {string} event ID `${event_type}_${subscription_number}`
	 */
	on<
		E extends EventName,
		K1 extends KeyType,
		V1,
		K2 extends KeyType,
		V2
	>(
		type : E,
		listener : Listener<E, K1, V1, K2, V2>,
		attributes : Attributes = {}
	) : string {
		if( !( type in this._listeners ) ) {
			// istanbul ignore next
			throw TypeError( INVALID_TYPE_ERROR_MSG`${ type }` );
		}
		const regIndex = ++this._entryCounter;
		const id = `${ type }${ DELIMITER }${ regIndex }`;
		( this._listeners[ type ] as {} )[ regIndex ] = {
			attributes, id, listen: listener
		};
		return id;
	}

	/**
	 * Subscribe to one-emit event
	 *
	 * @param {Attributes} [attributes] Any additional info to attribute to this event
	 * @returns {string} event ID `${event_type}_${subscription_number}`
	 */
	once<
		E extends EventName,
		K1 extends KeyType,
		V1,
		K2 extends KeyType,
		V2
	>(
		type : E,
		listener : Listener<E, K1, V1, K2, V2>,
		attributes : Attributes = {}
	) : string {
		const eventId = this.on( type, listener, attributes );
		const [ , entryNumber ] = eventId.split( DELIMITER );
		this._listeners[ type ][ entryNumber ].once = true;
		return eventId;
	}

	/** Defines data shared among listeners. */
	private _calcSharedData<
		E extends EventName,
		K1 extends KeyType,
		V1,
		K2 extends KeyType,
		V2
	>(
		type : E, args : EventArgsTable<K1, V1,K2, V2>[E]
	) : SharedEventInfo<E, K1, V1, K2, V2> {
		if( !this._hasTypeListeners( type ) ) { return }
		const data = getEventData( type, args );
		const date = new Date();
		const timestamp = date.getTime();
		makeImmutable( data );
		return { data, date, timestamp, type };
	}

	/** checks if listeners are currently registered for a given event type. */
	private _hasTypeListeners( type : EventName ) : boolean {
		return !!Object.keys( this._listeners[ type ] ).length;
	};
}

export default Events;

function makeImmutable( v : unknown ){
	if( !isObject( v ) ) { return }
	if( !Array.isArray( v ) ) {
		Object.keys( v ).forEach( k => {
			makeImmutable( v[ k ] );
		});
		Object.freeze( v );
		return;
	}
	Object.freeze( v.forEach( makeImmutable ) );
};

function getEventData<
	E extends EventName,
	K1 extends KeyType,
	V1,
	K2 extends KeyType,
	V2
>(
	type : E, args : EventArgsTable<K1, V1, K2, V2>[E]
) : EventDataTable<K1, V1, K2, V2>[E] {
	switch( type ) {
		case TYPE.AUTO_RENEWED: return renew( args as EventArgsTable<K1>["AUTO_RENEWED"] ) as EventDataTable<K1, V1, K2, V2>[E];
		case TYPE.CLEARED: return removeMany( args as EventArgsTable<K1, V1>["CLEARED"] ) as EventDataTable<K1, V1, K2, V2>[E];
		case TYPE.PRUNED: return removeMany( args as EventArgsTable<K1, V1>["PRUNED"] ) as EventDataTable<K1, V1, K2, V2>[E];
		case TYPE.PUT: return put( args as EventArgsTable<K1, V1, K2, V2>["PUT"] ) as EventDataTable<K1, V1, K2, V2>[E];
		case TYPE.REMOVED: return remove( args as EventArgsTable<K1, V1>["REMOVED"] ) as EventDataTable<K1, V1, K2, V2>[E];
	}
}

function getListenerRunner<
	E extends EventName,
	K1 extends KeyType,
	V1,
	K2 extends KeyType,
	V2
>(
	eventData : SharedEventInfo<E, K1, V1, K2, V2>
) : ListenerRunner<E, K1, V1, K2, V2> {
	const { date, ...eData } = eventData;
	return listener => {
		try {
			listener.listen( Object.freeze({
				...eData,
				attributes: cloneDeep( listener.attributes ),
				date: cloneDeep( date ),
				id: listener.id
			}) );
		} catch( e ) {
			// istanbul ignore next
			REF_ERROR_PATTERN.test( e.message ) && console.warn(
				SCHEDULED_EMIT_WARNING`${ listener.id }`, e
			);
		}
	};
}

function put<K1 extends KeyType, V1, K2 extends KeyType, V2>(
	args : EventArgsTable<K1, V1, K2, V2>["PUT"]
) : EventDataTable<K1, V1, K2, V2>["PUT"] {
	return {
		current: args[ 0 ] as MapEntry<K1, V1>,
		previous: args[ 1 ] as MapEntry<K2, V2>
	};
}

function remove<K extends KeyType, V>(
	args : EventArgsTable<K, V>["REMOVED"]
) : EventDataTable<K, V>["REMOVED"] {
	return { removed: args[ 0 ] as MapEntry<K, V> };
}

function removeMany<K extends KeyType, V>(
	args : EventArgsTable<K, V>["CLEARED"|"PRUNED"]
) : EventDataTable<K, V>["CLEARED"|"PRUNED"] {
	return { removed: args[ 0 ] as Array<MapEntry<K, V>> };
}

function renew<K extends KeyType>(
	args : EventArgsTable<K>["AUTO_RENEWED"]
) : EventDataTable<K>["AUTO_RENEWED"] {
	return {
		key: args[ 0 ] as K,
		createdAt: args[ 1 ],
		previouslyCreatedAt : args[ 2 ]
	};
}
