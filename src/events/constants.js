export const DELIMITER = '@@@';

export const EVENT_TYPE = Object.freeze({
	AUTO_RENEWED: 'AUTO_RENEWED',
	CLEARED: 'CLEARED',
	CLOSING: 'CLOSING',
	PRUNED: 'PRUNED',
	PUT: 'PUT',
	REMOVED: 'REMOVED'
});

/** @type {RemoveManyMapper} */
const removeMany = removedEntries => ({ removed: removedEntries });

export const EVENTDATA_MAPPER = Object.freeze({
	/**
	 * @type {(
	 * 		key: string,
	 * 		createdAt: number,
	 * 		previouslyCreatedAt: number
	 * ) => EventData["AUTO_RENEWED"]}
	 */
	AUTO_RENEWED: (
		key, createdAt, previouslyCreatedAt
	) => ({
		key, createdAt, previouslyCreatedAt
	}),
	/** @type {RemoveManyMapper} */
	CLEARED: removeMany,
	/** @type {() => EventData["CLOSING"]} */
	CLOSING: () => undefined,
	/** @type {RemoveManyMapper} */
	PRUNED: removeMany,
	/**
	 * @type {(
	 * 		newEntry: MapEntry,
	 * 		previousEntry?: MapEntry
	 * ) => EventData["PUT"]}
	 */
	PUT: ( newEntry, previousEntry ) => ({
		current: newEntry,
		previous: previousEntry
	}),
	/** @type {(removedEntry: MapEntry[]) => EventData["REMOVED"]} */
	REMOVED: removedEntry => ({ removed: removedEntry })
});

/** @typedef {import("../index").MapEntry<string>} MapEntry */
/**
 * @typedef {(event: {
 * 		attributes: Attributes,
 * 		data: EventData[T],
 *		date: Date,
 * 		timestamp: number,
 * 		type: T
 * }) => void} Listener
 * @template {EventType} T
 */
/** @typedef {{[x: string]: any}} Attributes */
/**
 * @typedef {{
 * 		attributes: Attributes,
 * 		listen: Listener<T>,
 * 		once?: boolean
 * }} ListenerInfo
 * @template {EventType} T
 */
/** @typedef {{[K in EventType]: ListenerInfo<K>}} ListenerInfoContainer */
/** @typedef {keyof typeof EVENT_TYPE} EventType */
/** @typedef {import("../constants").MapEntry} MapEntry */

/** @typedef {{removed: MapEntry[]}} RemoveManyReturnVal */
/** @typedef {(removedEntries: MapEntry[]) => RemoveManyReturnVal} RemoveManyMapper */

/**
 * @typedef {{
 *		AUTO_RENEWED: {
 *			key: string,
 *			createdAt: number,
 *			previouslyCreatedAt: number
 *		},
 *		CLEARED: RemoveManyReturnVal,
 *		CLOSING: undefined,
 *		PRUNED: RemoveManyReturnVal,
 *		PUT: {
 *			current: MapEntry,
 *			previous: MapEntry
 *		},
 *		REMOVED: {removed: MapEntry}
 * }} EventData
 */
