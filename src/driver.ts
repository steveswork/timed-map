import cloneDeep from 'lodash.clonedeep';
import isInteger from 'lodash.isinteger';

import { KeyType, MapEntry } from '.';

import { TTL30MINS } from './constants';
import { EVENT_TYPE as TYPE } from './events/constants';

import Events from './events';

class Driver<T> {

	private _events = new Events();
	private _maxAge : number = null;
	private _memoObject : Record<KeyType, MapEntry<KeyType, T>> = {};
	private _pruneDate : number = null;
	private _timer : NodeJS.Timeout = null;

	constructor( maxEntryAgeMillis? : number ) {
		this._maxAge = (
			this._isValidTTLInput( maxEntryAgeMillis )
				? maxEntryAgeMillis
				: TTL30MINS
		);
	}

	get events() { return this._events }

	/** all available entries. */
	get entries() {
		this._prune();
		return Object.values( this._memoObject );
	}

	/** has no map contents. */
	get isEmpty() { return !this.keys.length }

	/** all available keys */
	get keys() {
		this._prune();
		return Object.keys( this._memoObject );
	}

	get maxEntryAge() { return this._maxAge }

	set maxEntryAge( maxEntryAgeMillis : number ) {
		if( !this._isValidTTLInput( maxEntryAgeMillis ) ) { return }
		const startDate = this._pruneDate - this._maxAge;
		const currentTimeElapsed = Date.now() - startDate;
		this._maxAge = maxEntryAgeMillis;
		this._pruneDate = startDate + maxEntryAgeMillis;
		clearTimeout( this._timer );
		const timeoutDelay = this._maxAge - currentTimeElapsed;
		this._timer = setTimeout(
			() => this._prune(),
			timeoutDelay > 0 ? timeoutDelay : 0
		);
	}

	/** number of currently stored entries */
	get size() { return this.keys.length }

	get timer() { return this._timer }

	clear() {
		if( !Object.keys( this._memoObject ).length ) { return }
		const memoObject = cloneDeep( Object.values( this._memoObject ) ) as Array<MapEntry<KeyType, T>>;
		this._memoObject = {};
		this._tryResetAging();
		this._events.emit( TYPE.CLEARED, memoObject );
	}

	get<K extends KeyType>( key : K ) : T {
		if( !this.has( key ) ) { return }
		const createdAt = Date.now();
		const previouslyCreatedAt = this._memoObject[ key ].createdAt;
		this._memoObject[ key ].createdAt = createdAt;
		this._events.emit( TYPE.AUTO_RENEWED, key, createdAt, previouslyCreatedAt );
		return this._memoObject[ key ].value;
	}

	getEntry<K extends KeyType>( key : K ) : MapEntry<K, T>{
		const entry = this._getEntry( key );
		if( !entry ) { return }
		const createdAt = Date.now()
		this._memoObject[ key ].createdAt = createdAt;
		this._events.emit( TYPE.AUTO_RENEWED, key, createdAt, entry.createdAt );
		return entry;
	}

	has( key : KeyType ) : boolean {
		return !( key in this._memoObject )
			? false
			: this._isPrunableEntry( this._memoObject[ key ] )
				? !!this.remove( key )
				: true;
	}

	peak<K extends KeyType>( key : K ) : T {
		return this._getEntry( key )?.value;
	}

	put<K extends KeyType>(
		key : K,
		value : T,
		ttl? : number
	) : MapEntry<K, T> {
		const exEntry = this._getEntry( key );
		this._memoObject[ key ] = { createdAt: Date.now(), key, ttl, value };
		Object.keys( this._memoObject ).length === 1 && this._tryStartAging();
		this.events.emit(
			TYPE.PUT,
			cloneDeep( this._memoObject[ key ] ) as MapEntry<K, T>,
			exEntry
		);
		return exEntry;
	}

	remove<K extends KeyType>( key : K ) : MapEntry<K, T> {
		let exEntry : MapEntry<K, T> = cloneDeep( this._memoObject[ key ] );
		if( !exEntry ) { return }
		if( this._isPrunableEntry( exEntry ) ) { exEntry = undefined }
		delete this._memoObject[ key ];
		this._tryResetAging();
		this.events.emit( TYPE.REMOVED, exEntry );
		return exEntry;
	}

	private _getEntry<K extends KeyType>( key : K ) : MapEntry<K, T> {
		if( this.has( key ) ) {
			return cloneDeep( this._memoObject[ key ] );
		}
	}

	/** checks if an entry has become prune-eligible */
	private  _isPrunableEntry<K extends KeyType>({ createdAt, ttl } : MapEntry<K, T>) : boolean {
		return Date.now() - createdAt >= ( ttl ?? this._maxAge );
	}

	private _isValidTTLInput( ttlInput : number ) : boolean {
		return isInteger( ttlInput ) &&
			this._maxAge !== ttlInput &&
			ttlInput > 0
	}

	private _prune() {
		const data : Array<MapEntry<KeyType, T>> = [];
		for( const key in this._memoObject ) {
			if( this._isPrunableEntry( this._memoObject[ key ] ) ) {
				data.push( cloneDeep( this._memoObject[ key ] ) )
				delete this._memoObject[ key ];
			}
		}
		if( !data.length ) { return }
		!this._tryResetAging() && this._tryStartAging();
		this.events.emit( TYPE.PRUNED, data );
	}

	private _tryResetAging() : boolean {
		if( Object.keys( this._memoObject ).length ) {
			return false;
		}
		clearTimeout( this._timer );
		this._pruneDate = null;
		return true;
	}

	private _tryStartAging() : boolean {
		// istanbul ignore next
		if( !Object.keys( this._memoObject ).length ) {
			return false;
		}
		clearTimeout( this._timer );
		this._pruneDate = Date.now() + this._maxAge;
		this._timer = setTimeout(
			() => this._prune(),
			this._maxAge
		);
		return true;
	}
};

export default Driver;
