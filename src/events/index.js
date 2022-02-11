import cloneDeep from 'lodash.clonedeep';
import isObject from 'lodash.isobject';

import {
	DELIMITER,
	EVENTDATA_MAPPER as MAPPER,
	EVENT_TYPE as TYPE
} from './constants';

const TYPES = Object.values( TYPE );

const SCHEDULED_EMIT_WARNING = ( s, eventId ) => `\
Issues communicating event ID  ${ eventId }. \
If dealing with objects going out of scope, please consider using the \`emitNow\` method.\
`;

const INVALID_TYPE_ERROR_MSG = ( str, type ) => `\
Invalid event type: ${ type }. Valid event types are: [${ TYPES.join( ', ') }]\
`;

const REF_ERROR_PATTERN = /^[Cc]annot\s+set\s+property\s+.+\s+of\s+undefined$/;

const entryCounterSymbol = Symbol( 'ENTRY_COUNTER' );
const calcSharedDataSymbol = Symbol( 'CALC_SHARED_DATA' )
const hasTypeListenersSymbol = Symbol( 'HAS_TYPE_LISTENERS' );
const listenersSymbol = Symbol( 'LISTENERS' );

/** @param {*} v */
const makeImmutable = v => {
	if( !isObject( v ) ) {
		return;
	}
	if( !Array.isArray( v ) ) {
		Object.keys( v ).forEach( k => {
			makeImmutable( v[ k ] );
		});
		Object.freeze( v );
		return;
	}
	Object.freeze( v.forEach( makeImmutable ) );
};

/**
 * @param {SharedEventInfo<T>} eventData
 * @returns {(listner: ListenerInfo<T>) => void}
 * @template {EventType} T
 */
const getListenerRunner = eventData => {
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
			REF_ERROR_PATTERN.test( e.message ) && console.warn(
				SCHEDULED_EMIT_WARNING`${ listener.id }`,
				e
			);
		}
	};
};

class Events {

	/**
	 * Defines data shared among listeners.
	 *
	 * @param {T} type
	 * @param {...any} [data] is equal to arguments of ./constantsjs::EVENTDATA_MAPPER[T]
	 * @returns {SharedEventInfo<T>} SharedData
	 * @template {EventType} T
	 * @see {import("./constants").EVENTDATA_MAPPER}
	 * @memberof Events
	 */
	[ calcSharedDataSymbol ]( type, ...data ) {
		if( !this[ hasTypeListenersSymbol ]( type ) ) {
			return;
		}
		const date = new Date();
		const eData = MAPPER[ type ]( ...data );
		const timestamp = date.getTime();
		makeImmutable( eData );
		return ({ data: eData, date, timestamp, type });
	}

	/**
	 * checks if listeners are currently registered for a given event type
	 *
	 * @param {EventType} type
	 * @returns {boolean}
	 * @memberof Events
	 */
	[ hasTypeListenersSymbol ]( type ) {
		return !!Object.keys( this[ listenersSymbol ][ type ] ).length;
	};

	/**
	 * Creates an instance of Events.
	 *
	 * @memberof Events
	 */
	constructor() {
		this[ entryCounterSymbol ] = 0;
		/** @type {ListenerInfoContainer} */
		this[ listenersSymbol ] = Object.seal(
			TYPES.reduce(( o, v ) => {
				o[ v ] = {};
				return o;
			}, {} )
		);
	}

	/**
	 * Schedules events to run immediately at the completion of previously scheduled tasks.
	 *
	 * @param {T} type
	 * @param {...any} [data] is equal to arguments of ./constantsjs::EVENTDATA_MAPPER[T]
	 * @template {EventType} T
	 * @see {import("./constants").EVENTDATA_MAPPER}
	 * @memberof Events
	 */
	emit( type, ...data ) {
		const eventData = this[ calcSharedDataSymbol ]( type, ...data );
		if( eventData === undefined ) {
			return;
		}
		const listeners = cloneDeep( this[ listenersSymbol ][ type ] );
		for( const k in listeners ) {
			if( listeners[ k ].once ) {
				delete this[ listenersSymbol ][ type ][ k ];
			}
		}
		setTimeout(() => Object.values( listeners ).forEach( getListenerRunner( eventData ), 0 ) );
	}

	/**
	 * Runs events immediately.
	 *
	 * @param {T} type
	 * @param {...any} [data] is equal to arguments of ./constantsjs::EVENTDATA_MAPPER[T]
	 * @template {EventType} T
	 * @see {import("./constants").EVENTDATA_MAPPER}
	 * @memberof Events
	 */
	emitNow( type, ...data ) {
		const eventData = this[ calcSharedDataSymbol ]( type, ...data );
		if( eventData === undefined ) {
			return;
		}
		const listeners = this[ listenersSymbol ][ type ];
		const run = getListenerRunner( eventData );
		for( const k in listeners ) {
			run( listeners[ k ] );
			if( listeners[ k ].once ) {
				delete this[ listenersSymbol ][ type ][ k ];
			}
		}
	}

	/**
	 * Cancel event by listener function reference
	 *
	 * @param {T} type
	 * @param {Listener<T>} listener
	 * @template {EventType} T
	 */
	off( type, listener ) {
		const eventGroup = this[ listenersSymbol ][ type ];
		const entryNumber = Object.keys( eventGroup ).find(
			k => eventGroup[ k ].listen === listener
		);
		if( typeof entryNumber !== 'undefined' ) {
			delete this[ listenersSymbol ][ type ][ entryNumber ];
		}
	}

	/**
	 * Cancel event by eventId
	 *
	 * @param {string} eventId `${event_type}_${subscription_number}`
	 * @memberof Events
	 */
	offById( eventId ) {
		const [ type, entryNumber ] = eventId.split( DELIMITER );
		delete this[ listenersSymbol ][ type ][ entryNumber ];
	}

	/**
	 * Subscribe to event
	 *
	 * @param {T} type
	 * @param {Listener<T>} listener
	 * @param {Attributes} [attributes] Any additional info to attribute to this event
	 * @returns {string} event ID `${event_type}_${subscription_number}`
	 * @template {EventType} T
	 * @memberof Events
	 */
	on( type, listener, attributes = {} ) {
		if( !( type in this[ listenersSymbol ] ) ) {
			throw TypeError( INVALID_TYPE_ERROR_MSG`${ type }` );
		}
		const regIndex = ++this[ entryCounterSymbol ];
		const id = `${ type }${ DELIMITER }${ regIndex }`;
		this[ listenersSymbol ][ type ][ regIndex ] = {
			attributes, id, listen: listener
		};
		return id;
	}

	/**
	 * Subscribe to one-emit event
	 *
	 * @param {T} type
	 * @param {Listener<T>} listener
	 * @param {Attributes} [attributes] Any additional info to attribute to this event
	 * @returns {string} event ID `${event_type}_${subscription_number}`
 	 * @template {EventType} T
	 * @memberof Events
	 */
	once( type, listener, attributes = {} ) {
		const eventId = this.on( type, listener, attributes );
		const [ , entryNumber ] = eventId.split( DELIMITER );
		this[ listenersSymbol ][ type ][ entryNumber ].once = true;
		return eventId;
	}
}

export default Events;

/**
 * @typedef {import("./constants").Listener<T>} Listener
 * @template {EventType} T
 */
/**
 * @typedef {import('./constants').ListenerInfo<T>} ListenerInfo
 * @template {EventType} T
 */
/**
 * @typedef {import("./constants").SharedEventInfo<T>} SharedEventInfo
 * @template {EventType} T
 */
/** @typedef {import("./constants").Attributes} Attributes */
/** @typedef {import("./constants").ListenerInfoContainer} ListenerInfoContainer */
/** @typedef {import("./constants").EventType} EventType */
/** @typedef {import("./constants").MapEntry} MapEntry */
