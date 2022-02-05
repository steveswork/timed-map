# Timed-Map

**Name:** Timed-Map

**Install:**\
npm i -S @webkrafters/timed-map

## Description

A timed map javascript data structure.
Tracks and removes outdated infrequently `read` entries.

## Ideal Use-case

Ideal for in-app Application Level Memoization and Caching.


## Usage

```js
import TimedMap from '@webkrafters/timed-map';

const timedMap = new TimedMap( 1000 ); // max-age of 1-second per infrequently-used map entries

const timedMap = new TimedMap(); // defaults to 30 mins max-age

```

### MapEntry

A map entry object holds the following information:
```js
{
	createdAt: int // Date in millis since epoch
	key: string
	value: any
	ttl: int // Duration in millis
}
```

## Requirement

The TimedMap `close()` instance method must be called prior to `delete`ing or setting this map to null.
This cleans up the underlying driver along with any system resources used such as cpu timers etc.

## Public Interface

### constructor(maxEntryAgeMillis?: int): TimedMap

Creates an instance of TimedMap. The optional `maxEntryAgeMillis` value is a class-level TTL in milliseconds applied to all entries in the map. A default of 1800000ms (i.e. 30 minutes) is assigned if omitted. Any entry which remained `un-reead` at the end of the TTL-cycle is removed. `get(key)` and `getEntry(key)` methods constitute the only valid entry `read` operations. To obtain entry value without restarting the entry TTL-cycle, use the `peak(key)` method. Individual TTLs may be assigned to entries upon insertion. The individual TTL supersedes the class-level TTL for the individual entry.

### entries: int - readonly

Computed property: available entries.

### isEmpty: boolean - readonly

Computed property: check-flag confirming a map containing no entries.

### keys: string[] - readonly

Computed property: keys to all available entries.

### maxEntryAge: int

Property: TTL value in milliseconds applied to map entries. Setting this property triggers adjustments in the map's internal TTL cycle processes.

### size: int - readonly

Computed property: number of entries in the map

### clear(): void

Removes all entries from the map

### close(): void

Recommended pre-delete method: please use this method to release system resources and clean up the internal driver prior to `delete`ing this TimeMap instance or setting it to null.

### get(key: string): any

Returns the value at key and restarts the entry's TTL cycle. This constitutes a valid `read` operation.

### getEntry(key: string): MapEntry 

Returns the entry object residing at key. This constitutes a valid `read` operation.

### has(key: string): boolean

Verifies the presence of a valid map entry at this key

### peak(key: string): any

Returns the value at key without restarting the entry's TTL cycle. 

### put(key: string, value: any, ttl?: int ): MapEntry

Creates a new map entry. If an entry existed at the key, it is overriden and returned. When the optional `ttl` value is provided. It will take precedence over the class-level TTL value for calculating TTL cycles for this entry. Please the [GET](#get) method

### remove( key: string): MapEntry

If an entry existed at the key, it is removed and returned.

## License

	ISC


