import {
	DELIMITER,
	EVENTDATA_MAPPER as MAPPER,
	EVENT_TYPE as TYPE
} from './constants';

const TYPES = Object.values( TYPE );

const INVALID_TYPE_ERROR_MSG = ( str, type ) => `Invalid event type: ${ type }. Valid event types are: ${ TYPES }`;

const entryCounterSymbol = Symbol( 'ENTRY_COUNTER' );
const hasTypeListenersSymbol = Symbol( 'HAS_TYPE_LISTENERS' );
const listenersSymbol = Symbol( 'LISTENERS' );

class Events {

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
	 * @param {T} type
	 * @param {...any} [data] is equal to arguments of ./constantsjs::EVENTDATA_MAPPER[T]
	 * @template {EventType} T
	 * @see {import("./constants").EVENTDATA_MAPPER}
	 * @memberof Events
	 */
	emit( type, ...data ) {
		if( !this[ hasTypeListenersSymbol ]( type ) ) {
			return;
		}
		const timestamp = Date.now();
		const eventData = Object.freeze({
			data: MAPPER[ type ]( ...data ),
			date: new Date( timestamp ),
			timestamp,
			type
		});
		const listeners = this[ listenersSymbol ][ type ];
		Object.keys( listeners )
			.filter( k => {
				listeners[ k ].listen({
					attributes: listeners[ k ].attributes,
					...eventData
				});
				return listeners[ k ].once;
			})
			.forEach( k => {
				delete this[ listenersSymbol ][ type ][ k ];
			});
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
	 * @returns {string} eventId `${event_type}_${subscription_number}`
	 * @template {EventType} T
	 * @memberof Events
	 */
	on( type, listener, attributes = {} ) {
		if( !( type in this[ listenersSymbol ] ) ) {
			throw TypeError( INVALID_TYPE_ERROR_MSG`${ type }` );
		}
		this[ listenersSymbol ][ type ][ ++this[ entryCounterSymbol ] ] = {
			attributes, listen: listener
		};
		return `${ type }${ DELIMITER }${ this[ entryCounterSymbol ] }`;
	}

	/**
	 * Subscribe to one-emit event
	 *
	 * @param {T} type
	 * @param {Listener<T>} listener
	 * @param {Attributes} [attributes] Any additional info to attribute to this event
	 * @returns {string} eventId `${event_type}_${subscription_number}`
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
/** @typedef {import("./constants").Attributes} Attributes */
/** @typedef {import("./constants").ListenerInfoContainer} ListenerInfoContainer */
/** @typedef {import("./constants").EventType} EventType */
/** @typedef {import("./constants").MapEntry} MapEntry */
