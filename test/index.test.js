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
	});
});
