
import { EventName } from '..';

export const enum EVENT_TYPE {
	AUTO_RENEWED = 'AUTO_RENEWED',
	CLEARED = 'CLEARED',
	CLOSING = 'CLOSING',
	PRUNED = 'PRUNED',
	PUT = 'PUT',
	REMOVED = 'REMOVED'
};

export const EventTypes = [
	'AUTO_RENEWED',
	'CLEARED',
	'CLOSING',
	'PRUNED',
	'PUT',
	'REMOVED'
] as unknown as [EventName];

export const DELIMITER = '@@@';
