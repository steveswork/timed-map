import { EVENT_TYPE as TYPE } from '../src/events/constants';
import TimedMap from '../src';

const DEFAULT_TEST_KEY = 'test0';
const DEFAULT_TEST_VALUE = 'first test value';
const ENTRY2_KEY = 'test2';
const ENTRY2_VALUE = 'create a test2 entry';

const DEFAULT_ENTRY = Object.freeze({
	createdAt: expect.any( Number ),
	key: expect.any( String ),
	ttl: undefined,
	value: expect.anything()
});

const ENTRY_MOCK = expect.objectContaining( DEFAULT_ENTRY );

const TIMED_ENTRY_MOCK = expect.objectContaining({
	...DEFAULT_ENTRY, ttl: expect.any( Number )
});

const entryFinder = map => key => map.entries.find( k => k.key === key );

describe( 'TimedMap', () => {

	it( 'with default 30 Mins TTL per entry created', () => {
		const map = new TimedMap();
		expect( map.maxEntryAge ).toEqual( 18e5 );
		map.close();
	});

	test( 'toSring method', () => {
		const map = new TimedMap();
		expect( map.toString() ).toEqual( 'TimedMap class' );
		map.close();
	})

	describe( 'entry aging process', () => {

		it( 'deletes entry un-read within the recently completed TTL cycle', async () => {
			const TTL_CYCLE = 1000; // TTL 1-SECOND PER ENTRY (THOUGH RENEWABLE ONCE ENTRY READ)
			const timedMap = new TimedMap( TTL_CYCLE );
			timedMap.put( DEFAULT_TEST_KEY, DEFAULT_TEST_VALUE );
			expect( timedMap.size ).toEqual( 1 );
			await new Promise( resolve => setTimeout(() => {
				// un-read entry removed after 1-second ttl cycle
				expect( timedMap.has( DEFAULT_TEST_KEY ) ).toBe( false );
				timedMap.close();
				resolve();
			}, TTL_CYCLE ) );
		});

		it( 'extends entry TTL beyond the original 1-SECOND when read within the TTL cycle', async () => {
			const TTL_CYCLE = 1000; // TTL 1-SECOND PER ENTRY (THOUGH RENEWABLE ONCE ENTRY READ)
			const READ_POINT = 300;
			const timedMap = new TimedMap( TTL_CYCLE );
			const findEntryAt = entryFinder( timedMap );
			timedMap.put( DEFAULT_TEST_KEY, DEFAULT_TEST_VALUE );
			expect( timedMap.size ).toEqual( 1 );
			const originalCreatedAt = findEntryAt( DEFAULT_TEST_KEY ).createdAt;
			await new Promise( resolve => setTimeout(() => {
				// run read operation (i.e. `TimeMap::get(...)`) on `DEFAULT_TEST_KEY`
				// within the current 1-second ttl cycle.
				timedMap.get( DEFAULT_TEST_KEY );
				resolve();
			}, READ_POINT ) );
			await new Promise( resolve => setTimeout(() => {
				// read entry exists beyond the current 1-second ttl cycle
				expect( timedMap.has( DEFAULT_TEST_KEY ) ).toBe( true );
				// read entry creation-date had been renewed
				expect( findEntryAt( DEFAULT_TEST_KEY ).createdAt ).toBeGreaterThan( originalCreatedAt );
				timedMap.close();
				resolve();
			}, TTL_CYCLE - READ_POINT ) );
		});

		it( 'may accept individual entry TTL: such TTL supersedes class level ttl for the entry', async () => {
			const TTL_CYCLE = 500; // TTL 500-MILLIS PER ENTRY (THOUGH RENEWABLE ONCE ENTRY READ)
			const CUSTOM_ENTRY_TTL = 1000; // TTL 1000-MILLIS PER ENTRY (THOUGH RENEWABLE ONCE ENTRY READ)
			const timedMap = new TimedMap( TTL_CYCLE );
			const findEntryAt = entryFinder( timedMap );
			timedMap.put( DEFAULT_TEST_KEY, DEFAULT_TEST_VALUE, CUSTOM_ENTRY_TTL );
			expect( timedMap.size ).toEqual( 1 );
			expect( findEntryAt( DEFAULT_TEST_KEY ) ).toEqual( TIMED_ENTRY_MOCK );
			await new Promise( resolve => setTimeout(() => {
				// though un-read, entry persists beyond
				// the end of current TTL cycle
				expect( timedMap.has( DEFAULT_TEST_KEY ) ).toBe( true );
				resolve();
			}, TTL_CYCLE ) );
			await new Promise( resolve => setTimeout(() => {
				// un-read entry terminates at the end of own ttl
				expect( timedMap.has( DEFAULT_TEST_KEY ) ).toBe( false );
				timedMap.close();
				resolve();
			}, CUSTOM_ENTRY_TTL - TTL_CYCLE ) );
		});
	});

	describe( 'features', () => {
		/** @type {TimedMap} */ let map;
		beforeAll(() => {
			map = new TimedMap( 1000 );
			map.put( DEFAULT_TEST_KEY, DEFAULT_TEST_VALUE );
		});
		afterAll(() => {
			map.close();
		});
		it( 'can be created with user-defined `maxEntryAge` TTL property', () => {
			expect( map.maxEntryAge ).toEqual( 1000 );
		});
		it( 'accepts new values for `maxEntryAge` TTL property', () => {
			expect( map.maxEntryAge ).toEqual( 1000 );
			map.maxEntryAge = 300;
			expect( map.maxEntryAge ).toEqual( 300 );
		});

		describe( 'entries property', () => {
			it( 'provides all available entries in the map', () => {
				expect( map.entries ).toHaveLength( map.size );
				expect( map.entries ).toEqual( expect.arrayContaining([ ENTRY_MOCK ]) );
				const newMap = new TimedMap();
				expect( newMap.entries ).toHaveLength( 0 );
				expect( newMap.entries ).toEqual([]);
				newMap.close();
			});
			it( 'is readonly', () => {
				expect(() => {
					map.entries = expect.arrayContaining([ ENTRY_MOCK ]);
				}).toThrow()
			});
		});

		describe( 'isEmpty property', () => {
			it( 'tracks the map entry state', () => {
				expect( map.isEmpty ).toBe( false );
				const newMap = new TimedMap();
				expect( newMap.isEmpty ).toBe( true );
				newMap.close();
			});
			it( 'is readonly', () => {
				expect(() => {
					map.isEmpty = true;
				}).toThrow()
			});
		});

		describe( 'size property', () => {
			it( 'tracks number of entries in the map', () => {
				expect( map.size === 1 ).toBe( true );
				map.put( ENTRY2_KEY, ENTRY2_VALUE );
				expect( map.size ).toEqual( 2 );
				map.remove( ENTRY2_KEY ); // resets test map
			});
			it( 'is readonly', () => {
				expect(() => {
					map.size = 23;
				}).toThrow()
			});
		});

		describe( 'clear function', () => {
			it( 'removes all entries', () => {
				const testMap = new TimedMap();
				testMap.put( DEFAULT_TEST_KEY, DEFAULT_TEST_VALUE );
				testMap.put( ENTRY2_KEY, ENTRY2_VALUE );
				expect( testMap.size ).toEqual( 2 );
				testMap.clear();
				expect( testMap.size ).toEqual( 0 );
				expect( testMap.isEmpty ).toBe( true );
				testMap.put( DEFAULT_TEST_KEY, DEFAULT_TEST_VALUE );
				expect( testMap.size ).toEqual( 1 );
				expect( testMap.isEmpty ).toBe( false );
				testMap.close();
			});
		});

		describe( 'close function', () => {
			it( 'cleans up internal driver and system resources', () => {
				const closableMap = new TimedMap();
				closableMap.put( ENTRY2_KEY, ENTRY2_VALUE );
				expect( closableMap.has( ENTRY2_KEY ) ).toBe( true );
				closableMap.close();
				expect(() => {
					closableMap.has( ENTRY2_KEY );
				}).toThrow();
			});
		});

		describe( 'keys property', () => {
			const EXPECTED_KEYS = expect.arrayContaining([ expect.any( String ) ] );
			it( 'provides all available keys in the map', () => {
				expect( map.keys ).toHaveLength( map.size );
				expect( map.keys ).toEqual( EXPECTED_KEYS );
				const newMap = new TimedMap();
				expect( newMap.keys ).toHaveLength( 0 );
				expect( newMap.keys ).toEqual([]);
				newMap.close();
			});
			it( 'is readonly', () => {
				expect(() => {
					map.keys = EXPECTED_KEYS;
				}).toThrow()
			});
		});

		it( 'can check availability of existing entry', () => {
			expect( map.has( DEFAULT_TEST_KEY ) ).toBe( true ); // entry with the cited key exists
			expect( map.has( 'test 100' ) ).toBe( false ); // entry with key 'test100' does not exist
		});

		describe( 'accessor functions', () => {

			let findEntryAt;

			beforeAll(() => {
				findEntryAt = entryFinder( map );
			});

			describe( 'get function', () => {
				it( 'can obtain entry value', () => {
					expect( map.get( DEFAULT_TEST_KEY ) ).toBe( DEFAULT_TEST_VALUE );
				});
				it( 'restarts the accessed entry\'s creation date to current date', async () => {
					const previouslyCreatedAt = findEntryAt( DEFAULT_TEST_KEY ).createdAt;
					await new Promise( resolve => setTimeout(() => {
						map.get( DEFAULT_TEST_KEY );
						expect( previouslyCreatedAt ).toBeLessThan( findEntryAt( DEFAULT_TEST_KEY ).createdAt );
						resolve();
					}, 100 ) );
				});
			});

			describe( 'peak function', () => {
				it( 'can obtain entry value', () => {
					expect( map.peak( DEFAULT_TEST_KEY ) ).toBe( DEFAULT_TEST_VALUE );
				});
				it( 'does not restart the accessed entry\'s creation date', () => {
					const previouslyCreatedAt = findEntryAt( DEFAULT_TEST_KEY ).createdAt;
					map.peak( DEFAULT_TEST_KEY );
					expect( previouslyCreatedAt ).toEqual( findEntryAt( DEFAULT_TEST_KEY ).createdAt );
				});
			});

			describe( 'getEntry function', () => {
				it( 'can obtain entry located at key', () => {
					expect( findEntryAt( DEFAULT_TEST_KEY ) ).toEqual( ENTRY_MOCK );
				});
				it( 'restarts the accessed entry\'s creation date to current date', async () => {
					const previouslyCreatedAt = findEntryAt( DEFAULT_TEST_KEY ).createdAt;
					await new Promise( resolve => setTimeout(() => {
						map.getEntry( DEFAULT_TEST_KEY );
						expect( previouslyCreatedAt ).toBeLessThan(
							findEntryAt( DEFAULT_TEST_KEY ).createdAt
						);
						resolve();
					}, 100 ) );
				});
			});
		});

		describe( 'put function', () => {

			afterEach(() => {
				map.remove( ENTRY2_KEY );
				map.isEmpty && map.put(
					DEFAULT_TEST_KEY,
					DEFAULT_TEST_VALUE
				);
			});

			describe( 'creating new entry', () => {
				let previouslyExisted, returnedValue;
				beforeAll(() => {
					previouslyExisted = map.has( ENTRY2_KEY );
					returnedValue = map.put( ENTRY2_KEY, ENTRY2_VALUE );
				});
				it( 'adds new key entry to the map', () => {
					expect( previouslyExisted ).toBe( false );
					expect( map.has( ENTRY2_KEY ) ).toBe( true );
				});
				it( 'returns `undefined` existing entry at the key', () => {
					expect( returnedValue ).toBeUndefined();
				});
			});

			describe( 'updating new entry', () => {
				let entryMap, findEntryAt, previouslyExisted, previousEntry, returnedValue;
				afterAll(() => {
					entryMap.close();
				});
				beforeAll(() => {
					entryMap = new TimedMap( 60000 );
					entryMap.put( ENTRY2_KEY, ENTRY2_VALUE );
					previouslyExisted = entryMap.has( ENTRY2_KEY );
					findEntryAt = entryFinder( entryMap );
					previousEntry = findEntryAt( ENTRY2_KEY );
					for( let i = 0; i < 1e9; i++ ) { /* delay next method call */ }
					returnedValue = entryMap.put( ENTRY2_KEY, ENTRY2_VALUE );
				});
				it( 'overrides existing entry at key with new entry', () => {
					expect( previouslyExisted ).toBe( true );
					expect( findEntryAt( ENTRY2_KEY ) ).not.toEqual( previousEntry );
				});
				it( 'entry at key restarts with a new creation date', () => {
					expect( findEntryAt( ENTRY2_KEY ).createdAt ).toBeGreaterThan( previousEntry.createdAt );
				});
				it( 'returns the overridden entry', () => {
					expect( previousEntry ).toEqual( returnedValue );
				});
			});
		});

		describe( 'remove function', () => {
			let findEntryAt, previouslyExisted, previousEntry, returnedValue;
			beforeAll(() => {
				map.put( ENTRY2_KEY, ENTRY2_VALUE );
				findEntryAt = entryFinder( map );
				previouslyExisted = map.has( ENTRY2_KEY );
				previousEntry = findEntryAt( ENTRY2_KEY );
				returnedValue = map.remove( ENTRY2_KEY );
			});
			it( 'can remove existing entry', () => {
				expect( previouslyExisted ).toBe( true );
				expect( map.has( ENTRY2_KEY ) ).toBe( false );
			});
			it( 'returns removed entry', () => {
				expect( previousEntry ).toEqual( returnedValue );
			});
		});

		describe( 'events', () => {

			let eventData;
			beforeAll(() => {
				eventData = Object.freeze({
					attributes: expect.any( Object ),
					data: undefined,
					date: expect.any( Date ),
					timestamp: expect.any( Number ),
					type: undefined
				});
			});

			describe( 'event administration', () => {
				let timedMap;
				afterAll(() => {
					timedMap.close();
				});
				beforeAll(() => {
					timedMap = new TimedMap();
				});
				describe( '`once` method: a one-time event', () => {
					test( 'is automatically canceled after a single use', () => {
						const listenerMock = jest.fn();
						timedMap.put( DEFAULT_TEST_KEY, DEFAULT_TEST_VALUE );
						timedMap.put( ENTRY2_KEY, ENTRY2_VALUE );
						timedMap.once( TYPE.CLEARED, listenerMock );
						timedMap.clear();
						expect( listenerMock ).toHaveBeenCalledTimes( 1 );
						listenerMock.mockReset();
						timedMap.put( DEFAULT_TEST_KEY, DEFAULT_TEST_VALUE );
						timedMap.put( ENTRY2_KEY, ENTRY2_VALUE );
						timedMap.clear();
						expect( listenerMock ).not.toHaveBeenCalled();
					});
					it( 'is cancelable prior to first use', () => {
						const listenerMock = jest.fn();
						timedMap.put( DEFAULT_TEST_KEY, DEFAULT_TEST_VALUE );
						timedMap.put( ENTRY2_KEY, ENTRY2_VALUE );
						timedMap.once( TYPE.CLEARED, listenerMock );
						timedMap.off( TYPE.CLEARED, listenerMock )
						timedMap.clear();
						expect( listenerMock ).not.toHaveBeenCalled();
					});
					it( 'allows user to capture arbitrary data as part of event attributes for later use', () => {
						const attributes = { message: 'Mic check 1-2-1-2' };
						const listenerMock = jest.fn();
						timedMap.put( DEFAULT_TEST_KEY, DEFAULT_TEST_VALUE );
						timedMap.put( ENTRY2_KEY, ENTRY2_VALUE );
						timedMap.once( TYPE.CLEARED, listenerMock, attributes );
						timedMap.clear();
						expect( listenerMock ).toHaveBeenCalledWith(
							expect.objectContaining({ attributes })
						)
					});
				});

				describe( '`on` method: long-lived event', () => {
					test( 'is not automatically canceled after a single use', () => {
						const listenerMock = jest.fn();
						timedMap.put( DEFAULT_TEST_KEY, DEFAULT_TEST_VALUE );
						timedMap.put( ENTRY2_KEY, ENTRY2_VALUE );
						timedMap.on( TYPE.CLEARED, listenerMock );
						timedMap.clear();
						expect( listenerMock ).toHaveBeenCalledTimes( 1 );
						listenerMock.mockReset();
						timedMap.put( DEFAULT_TEST_KEY, DEFAULT_TEST_VALUE );
						timedMap.put( ENTRY2_KEY, ENTRY2_VALUE );
						timedMap.clear();
						expect( listenerMock ).toHaveBeenCalledTimes( 1 );
					});
					it( 'allows user to capture arbitrary data as part of event attributes for later use', () => {
						const attributes = { message: 'Mic check 1-2-1-2' };
						const listenerMock = jest.fn();
						timedMap.put( DEFAULT_TEST_KEY, DEFAULT_TEST_VALUE );
						timedMap.put( ENTRY2_KEY, ENTRY2_VALUE );
						timedMap.on( TYPE.CLEARED, listenerMock, attributes );
						timedMap.clear();
						expect( listenerMock ).toHaveBeenCalledWith(
							expect.objectContaining({ attributes })
						)
					});
				});

				describe( 'event cancellation', () => {
					test( '`off` method: remove event listener by listener reference', () => {
						const listenerMock = jest.fn();
						timedMap.put( DEFAULT_TEST_KEY, DEFAULT_TEST_VALUE );
						timedMap.put( ENTRY2_KEY, ENTRY2_VALUE );
						timedMap.on( TYPE.CLEARED, listenerMock );
						timedMap.clear();
						expect( listenerMock ).toHaveBeenCalledTimes( 1 );
						listenerMock.mockReset();
						timedMap.put( DEFAULT_TEST_KEY, DEFAULT_TEST_VALUE );
						timedMap.put( ENTRY2_KEY, ENTRY2_VALUE );
						timedMap.off( TYPE.CLEARED, listenerMock );
						timedMap.clear();
						expect( listenerMock ).not.toHaveBeenCalled();
					});
					test( '`offById` method: remove event listener by event id', () => {
						const listenerMock = jest.fn();
						timedMap.put( DEFAULT_TEST_KEY, DEFAULT_TEST_VALUE );
						timedMap.put( ENTRY2_KEY, ENTRY2_VALUE );
						const eventId = timedMap.on( TYPE.CLEARED, listenerMock );
						timedMap.clear();
						expect( listenerMock ).toHaveBeenCalledTimes( 1 );
						listenerMock.mockReset();
						timedMap.put( DEFAULT_TEST_KEY, DEFAULT_TEST_VALUE );
						timedMap.put( ENTRY2_KEY, ENTRY2_VALUE );
						timedMap.offById( eventId );
						timedMap.clear();
						expect( listenerMock ).not.toHaveBeenCalled();
					});
				})
			});

			describe( `${ TYPE.AUTO_RENEWED } event`, () => {
				it( 'is emitted per `read` operation after completing all current tasks', async () => {
					const renewableMap = new TimedMap( 1000 );
					renewableMap.put( ENTRY2_KEY, ENTRY2_VALUE );
					const listenerMock = jest.fn();
					renewableMap.on( TYPE.AUTO_RENEWED, listenerMock );
					renewableMap.get( ENTRY2_KEY ); // read operation
					renewableMap.peak( ENTRY2_KEY ); // non-read operation
					renewableMap.getEntry( ENTRY2_KEY ); // read operation
					await new Promise( resolve => setTimeout(() => { // wait for emit at end of task queue
						renewableMap.close();
						expect( listenerMock.mock.calls.length ).toBe( 2 );
						listenerMock.mock.calls.forEach( c => {
							expect( c[ 0 ] ).toEqual({
								...eventData,
								data: {
									key: ENTRY2_KEY,
									createdAt: expect.any( Number ),
									previouslyCreatedAt: expect.any( Number )
								},
								type: TYPE.AUTO_RENEWED
							})
						});
						resolve();
					}, 300 ) );
				})
			});

			describe( `${ TYPE.CLEARED } event`, () => {
				it( 'is emitted per map reset operations', () => {
					const clearableMap = new TimedMap( 1000 );
					clearableMap.put( DEFAULT_TEST_KEY, DEFAULT_TEST_VALUE );
					clearableMap.put( ENTRY2_KEY, ENTRY2_VALUE );
					const listenerMock = jest.fn();
					clearableMap.on( TYPE.CLEARED, listenerMock );
					clearableMap.clear(); // reset operation
					clearableMap.peak( DEFAULT_TEST_KEY ); // non-reset operation
					clearableMap.close();
					expect( listenerMock ).toHaveBeenCalledTimes( 1 );
					expect( listenerMock ).toHaveBeenCalledWith({
						...eventData,
						data: {
							removed: expect.arrayContaining([ DEFAULT_ENTRY ])
						},
						type: TYPE.CLEARED
					});
				});
			});

			describe( `${ TYPE.CLOSING } event`, () => {
				it( 'is emitted before map close operation', () => {
					const closableMap = new TimedMap( 1000 );
					closableMap.put( ENTRY2_KEY, ENTRY2_VALUE );
					const listenerMock = jest.fn();
					closableMap.on( TYPE.CLOSING, listenerMock );
					closableMap.close(); // close operation
					expect(() => {
						closableMap.peak( ENTRY2_KEY ); // confirm close operation
					}).toThrow();
					expect( listenerMock ).toHaveBeenCalledTimes( 1 );
					expect( listenerMock ).toHaveBeenCalledWith({
						...eventData,
						type: TYPE.CLOSING
					});
				})
			});

			describe( `${ TYPE.PRUNED } event`, () => {
				it( 'is emitted after pruning outdated entries', async () => {
					const prunableMap = new TimedMap( 250 );
					prunableMap.put( DEFAULT_TEST_KEY, DEFAULT_TEST_VALUE, 1000 );
					prunableMap.put( ENTRY2_KEY, ENTRY2_VALUE );
					const listenerMock = jest.fn();
					prunableMap.on( TYPE.PRUNED, listenerMock );
					await new Promise( resolve => setTimeout(() => { // wait for prune to have been triggered at end of ttl cyle
						prunableMap.close();
						expect( listenerMock ).toHaveBeenCalledTimes( 1 );
						expect( listenerMock ).toHaveBeenCalledWith({
							...eventData,
							data: {
								removed: [{
									...DEFAULT_ENTRY,
									key: ENTRY2_KEY,
									value: ENTRY2_VALUE
								}]
							},
							type: TYPE.PRUNED
						});
						resolve();
					}, 300 ) );
				});
			});

			describe( `${ TYPE.PUT } event`, () => {
				it( 'is emitted per `put` entry operation after completing all current tasks', async () => {
					const OLD_TEST_VALUE = 'This is an old test2 value...';
					const putableMap = new TimedMap( 1000 );
					putableMap.put( ENTRY2_KEY, OLD_TEST_VALUE );
					const listenerMock = jest.fn();
					const next = () => new Promise( resolve => setTimeout(() => { // wait for emit at end of task queue
						putableMap.close();
						expect( listenerMock ).toHaveBeenCalledTimes( 1 );
						expect( listenerMock ).toHaveBeenCalledWith({
							...eventData,
							data: {
								current: {
									...DEFAULT_ENTRY,
									key: ENTRY2_KEY,
									value: ENTRY2_VALUE
								},
								previous: {
									...DEFAULT_ENTRY,
									key: ENTRY2_KEY,
									value: OLD_TEST_VALUE
								}
							},
							type: TYPE.PUT
						});
						resolve();
					}, 300 ) );
					await new Promise( resolve => setTimeout( async () => { // delay adding listener to allow previous `put` tasks to complete
						putableMap.on( TYPE.PUT, listenerMock );
						putableMap.put( ENTRY2_KEY, ENTRY2_VALUE ); // put entry operation
						putableMap.peak( ENTRY2_KEY ); // non-put entry operation
						putableMap.getEntry( ENTRY2_KEY ); // non-put operation
						await next();
						resolve();
					}, 0 ) );
				});
			});

			describe( `${ TYPE.REMOVED } event`, () => {
				it( 'is emitted to notify observers of entry removal after completing all current tasks', async () => {
					const removableMap = new TimedMap();
					removableMap.put( DEFAULT_TEST_KEY, DEFAULT_TEST_VALUE, 1000 );
					const listenerMock = jest.fn();
					removableMap.on( TYPE.REMOVED, listenerMock );
					removableMap.remove( DEFAULT_TEST_KEY );
					await new Promise( resolve => setTimeout(() => { // wait for remove to have been triggered at end of task queue completion
						removableMap.close();
						expect( listenerMock ).toHaveBeenCalledTimes( 1 );
						expect( listenerMock ).toHaveBeenCalledWith({
							...eventData,
							data: {
								removed: {
									...DEFAULT_ENTRY,
									ttl: 1000
								}
							},
							type: TYPE.REMOVED
						});
						resolve();
					}, 300 ) );
				});
			});
		});
	});
});
