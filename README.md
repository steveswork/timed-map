# Timed-Map

**Name:** Timed-Map

**Install:**\
npm i -S @webkrafters/timed-map

## Description

A timed map javascript data structure.
Tracks and removes outdated less frequently used entries.

## Ideal Use-case

Ideal for in-app Application Level Memoization and Caching.


## Usage

```
import TimedMap from '@webkrafters/timed-map';

const timedMap = new TimedMap( 1000 ); // max-age of 1-second per infrequently-used map entries

const timedMap = new TimedMap(); // defaults to 30 mins max-age

```

## Requirement

The TimedMap `close()` instance method must be called prior to `delete`ing or setting this map to null.
This cleans up the underlying driver along with any system resources used such as the timers etc.
