# Timed-Map

**Name:** Timed-Map

**Install:**\
npm i -S @webkrafters/timed-map

## Description

An observable timed map javascript data structure.
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

Creates an instance of TimedMap. The optional `maxEntryAgeMillis` value is a class-level TTL in milliseconds applied to all entries in the map. A default of 1800000ms (i.e. 30 minutes) is assigned if omitted. Any entry which remained `un-read` at the end of the TTL-cycle is removed. `get(key)` and `getEntry(key)` methods constitute the only valid entry `read` operations. To obtain entry value without restarting the entry TTL-cycle, see the `peak(key)` method. Individual TTLs may be assigned to entries upon insertion. See the `put(...)` method. The individual TTL supersedes the class-level TTL for the individual entry.

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

### off(type: EventType, listener: Eventlistener): void

Cancels event by listener function reference. Please see Events section below for more on event types and event listener.

### offById(eventId: string): void

Cancels event by event ID. Please see Events section below for more on event ID.

### on(type: EventType, listener: Eventlistener, attributes?: Object): string

Subscribes to event of event type and returns unique eventId. Supply any additional info to capture as part of this event to the optional `attribute` object argument. Please see Events section below for more on event types, event ID and event listener.

### once(type: EventType, listener: Eventlistener, attributes?: Object): string

Subscribes to one-use event of event type and returns unique eventId. Supply any additional info to capture as part of this event to the optional `attribute` object argument. Please see Events section below for more on event types, event ID and event listener.

### peak(key: string): any

Returns the value at key without restarting the entry's TTL cycle. 

### put(key: string, value: any, ttl?: int ): MapEntry

Creates a new map entry. If an entry existed at the key, it is overriden and returned. When the optional `ttl` value is supplied, it takes precedence over the class-level TTL value for calculating TTL cycles for this entry. Please see the `get` and `getEntry` methods.

### remove( key: string): MapEntry

If an entry existed at the key, it is removed and returned.

## Events

This map is observable and provides pathways for notifying observers of relevant changes within. For this purpose, six event types have been provided.

### Event Map Table
-----------------------------------------------------------------------------------------------------
|Event Type   |Trigger												  |Event Data
|-------------|-------------------------------------------------------|-------------------------------
|AUTO_RENEWED | After an entry read (See valid read operations above) |key: string<br/>createdAt: int<br />previouslyCreatedAt: int
|CLEARED      | After a map `clear` operation						  |removed: MapEntry[]
|CLOSING      | The `close` method call prior to clean up operation.  |undefined
|PRUNED       | After pruning outdated entries						  |removed: MapEntry[]
|PUT          | After a `put` method call operation					  |current: MapEntry<br />previous: MapEntry
|REMOVED      | After a `remove` method call operation				  |removed: MapEntry
--------------------------------------------------------------------------------------------------------

<u><b>Timing:</b></u> Excluding the `CLOSE` event, all event listeners are scheduled to run at the conclusion of previously scheduled tasks. `CLOSE` event listeners are run immediately.

-------------------------------------------------------------------------------------------------

### Event Listener

The event listener is triggered with a lone argument: the event payload. The event payload object emitted contains the following information:

<b>attributes:</b> Object (Please see the `on` method discussion above)<br />
<b>data:</b> Event Data Object (See Event Map Table above)<br /> 
<b>date:</b> Date - event date<br />
<b>id:</b> string - event ID<br />
<b>timestamp:</b> int - event date in milliseconds<br />
<b>type:</b> Event Type (See Event Map Table above)<br />

<u><b>Immutability:</b></u> With the exception of `attributes` and `date`, immutability is maintained on all properties of the event payload. The `date` property is a native Date instance object. The `attributes` property is presented to the user exactly as defined by the user.

### Event ID

Every subscribed event listener is assigned a unique event ID during subscription. The `on` and `once` methods constitute the two avenues for event subscription. These methods return the unique event ID correspondingly. While the listener function reference remains the most popular means for identifying events for cancellation, the event ID is the surest means of accomplishing same purpose. Please see the `off` and `offById` methods.







## License

	ISC


