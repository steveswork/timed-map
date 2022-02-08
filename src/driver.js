import cloneDeep from 'lodash.clonedeep';
import isInteger from 'lodash.isinteger';

import {
	EVENT_TYPE as TYPE,
	TTL30MINS
} from './events/constants';
import Events from './events';

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
		/** @type {Events} */
		this.events = new Events();
	}

	/**
	 * all available entries.
	 *
	 * @memberof TimedMap
	 * @property
	 * @readonly
	 */
	get entries() {
		this.prune();
		return Object.values( this.memoObject );
	}

	/**
	 * has no map contents.
	 *
	 * @memberof TimedMap
	 * @property
	 * @readonly
	 */
	get isEmpty() {
		this.prune();
		return !Object.keys( this.memoObject ).length;
	}

	/**
	 * all available keys
	 *
	 * @memberof TimedMap
	 * @property
	 * @readonly
	 */
	get keys() {
		this.prune();
		return Object.keys( this.memoObject );
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

	get size() {
		this.prune();
		return Object.keys( this.memoObject ).length;
	}

	clear() {
		if( !Object.keys( this.memoObject ).length ) {
			return;
		}
		const memoObject = cloneDeep( Object.values( this.memoObject ) );
		this.memoObject = {};
		this.tryResetAging();
		this.events.emit( TYPE.CLEARED, memoObject );
	}

	/** @type {(key: string) => *} */
	get( key ) {
		if( !this.has( key ) ) {
			return undefined;
		}
		const createdAt = Date.now();
		const previouslyCreatedAt = this.memoObject[ key ].createdAt;
		this.memoObject[ key ].createdAt = createdAt;
		setTimeout(() => {
			this.events.emit( TYPE.AUTO_RENEWED, key, createdAt, previouslyCreatedAt );
		}, 0 );
		return this.memoObject[ key ].value;
	}

	_getEntry( key ) {
		return this.has( key )
			? cloneDeep( this.memoObject[ key ] )
			: undefined;
	}

	/**
	 * @type {(key: K) => MapEntry<K>}
	 * @template {string} K
	 */
	getEntry( key ) {
		const entry = this._getEntry( key );
		if( !entry ) {
			return undefined;
		}
		const createdAt = Date.now()
		this.memoObject[ key ].createdAt = createdAt;
		setTimeout(() => {
			this.events.emit( TYPE.AUTO_RENEWED, key, createdAt, entry.createdAt );
		}, 0 );
		return entry;
	}

	/** @type {(key: string) => boolean} */
	has( key ) {
		return !( key in this.memoObject )
			? false
			: this.isPrunableEntry( this.memoObject[ key ] )
				? !!this.remove( key )
				: true;
	}

	/**
	 * checks if an entry has become prune-eligible
	 *
	 * @param {MapEntry<K>} entry
	 * @template {string} K
	 */
	isPrunableEntry({ createdAt, ttl }) {
		return Date.now() - createdAt >= ( ttl ?? this.maxAge );
	}

	/** @type {(ttlInput: number) => boolean} */
	isValidTTLInput( ttlInput ) {
		return isInteger( ttlInput ) &&
			this.maxAge !== ttlInput &&
			ttlInput > 0
	};

	/** @type {(key: string) => *} */
	peak( key ) {
		const entry = this._getEntry( key );
		if( entry ) {
			return entry.value;
		}
	}

	/** @type {() => void} */
	prune() {
		const data = [];
		for( const key in this.memoObject ) {
			if( this.isPrunableEntry( this.memoObject[ key ] ) ) {
				data.push( cloneDeep( this.memoObject[ key ] ) )
				delete this.memoObject[ key ];
			}
		}
		!this.tryResetAging() && this.tryStartAging();
		this.events.emit( TYPE.PRUNED, data );
	}

	/**
	 * @param {K} key
	 * @param {*} value
	 * @param {number} [ttl]
	 * @returns {MapEntry<K>}
	 * @template {string} K
	 */
	put( key, value, ttl ) {
		const exEntry = this._getEntry( key );
		this.memoObject[ key ] = {
			createdAt: Date.now(), key, ttl, value
		};
		Object.keys( this.memoObject ).length === 1 && this.tryStartAging();
		setTimeout(() => this.events.emit(
			TYPE.PUT,
			cloneDeep( this.memoObject[ key ] ),
			exEntry
		), 0 );
		return exEntry;
	}

	/**
	 * @type {(key: K) => MapEntry<K>}
	 * @template {string} K
	 */
	remove( key ) {
		let exEntry = cloneDeep( this.memoObject[ key ] );
		if( !exEntry ) {
			return;
		}
		if( this.isPrunableEntry( exEntry ) ) {
			exEntry = undefined;
		}
		delete this.memoObject[ key ];
		this.tryResetAging();
		setTimeout(() => this.events.emit( TYPE.REMOVED, exEntry ), 0 );
		return exEntry;
	}

	toString() {
		return 'TimedMap::Driver class';
	}

	/** @type {() => boolean} */
	tryResetAging() {
		if( Object.keys( this.memoObject ).length ) {
			return false;
		}
		clearTimeout( this.timer );
		this.pruneDate = null;
		return true;
	}

	/** @type {() => boolean} */
	tryStartAging() {
		if( !Object.keys( this.memoObject ).length ) {
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

export default Driver;
