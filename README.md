# oja

Lightweight pub/sub module with event backlog, timeout support that maps events to promises and back as well as chains them to other topics.

[![codecov](https://codecov.io/gh/dimichgh/oja/branch/master/graph/badge.svg)](https://codecov.io/gh/dimichgh/oja)
[![Build Status](https://travis-ci.org/dimichgh/oja.svg?branch=master)](https://travis-ci.org/dimichgh/oja) [![NPM](https://img.shields.io/npm/v/oja.svg)](https://www.npmjs.com/package/oja)
[![Downloads](https://img.shields.io/npm/dm/oja.svg)](http://npm-stat.com/charts.html?package=oja)
[![Known Vulnerabilities](https://snyk.io/test/github/dimichgh/oja/badge.svg)](https://snyk.io/test/github/dimichgh/oja)

### Idea

The main reason for creation of this module is to allow decoupling business logic into smaller isolated stage components in the application via pub/sub API that leads to a simpler/isolated unit testing with easy mocking of input data and easy composition of components into higher async structures.

### Architecture

The module is based on pub/sub interface.
It accumulates events in the backlog for new subscribers. This is pros and cons:

* Allows consumers/producers to be added in any order and guarantees delivery of an event.
* Accumulates events in memory, thus it cannot be used for long running flows as it eventually will run out of memory.
* It is good fit for short request/stream flows that eventually end and GC-ed.

### Install

```
npm install oja -S
```

### Usage

#### Simple pub/sub
```js
const Flow = require('oja').Flow;
const flow = new Flow();

// create consumer component
const consumer = flow.consume('foo');
consumer.then(foo => {
    console.log(foo); // prints 'bar'
});

// define producer component
const producer = flow.define('foo');
// publish
producer.pub('bar');
```

#### Shorter form for clarity:

```js
// create consumer component
flow
.consume('foo', foo => {
    console.log(foo); // prints 'bar'
})
.define('foo', 'bar');
```

#### Consuming multiple events

```js
// create consumer component
flow
.consume('foo', foo => {
    console.log(foo); // prints 'bar1' and 'bar2'
})
.define('foo', 'bar1')
.define('foo', 'bar1');
```

#### Using promise

```js
// create consumer component
flow
.consume('foo', foo => {
    console.log(foo); // prints 'bar'
})
.define('foo', new Promise(resolve => {
    resolve('bar');
}));
```

#### Multiple consumers, single producer

```js
// create consumer component
flow
.consume('foo', foo => {
    console.log(foo); // prints 'bar'
})
.consume('foo', foo => {
    console.log(foo); // prints 'bar'
})
.define('foo', 'bar');
```

#### Chaining actions, mixing, etc.

```js
// NOTE: the order of consume/define does not matter
// create consumer component
flow
.consume('foo', (foo, runtime) => {
    console.log(foo); // prints 'faa'
    runtime.define('qoo', 'qaa'); // can consume and produce new data
})
.consume('qoo', (qoo, runtime) => {
    console.log(qoo); // prints 'qaa'
    runtime.define('woo', Promise.resolve('waa')); // can use async promise
})
// start chain reaction here
.define('foo', 'faa')   
// lets produce multiple events via event emitter
.consume('woo', (woo, runtime) => {    
    console.log(woo); // prints waa
    // define as event emitter
    const roo = runtime.define('roo');
    // simulate async flow with two event emitted
    setImmediate(() => {
        // generate multiple events
        roo.pub('raa1');
        roo.pub('raa2');
    });
})
// validate
.consume('roo', roo => {
    console.log(roo);   // prints raa1 and raa2
})
// consume multiple topics
.consume(['foo', 'qoo'], input => {
    console.log(input.foo);     // prints faa
    console.log(input.qoo);     // prints qaa
})
// can consume inside consume
.consume('foo', (foo, runtime) => {
    console.log(foo);     // prints faa
    runtime.consume('qoo', qoo => {
        console.log(input.qoo);     // prints qaa
    });
    // or
    flow.consume('qoo', qoo => {
        console.log(input.qoo);     // prints qaa
    });
})
// can generate multiple events using pub
.define('doo', runtime => {
    runtime.pub('daa1');
    runtime.pub('daa2');
    runtime.pub('daa3');
})
.consume('doo', doo => {
    console.log(doo); // prints daa1, daa2, daa3
});
// NOTE: we can consume first event via promise if we are not interested in the rest
flow.consume('doo').then(doo => {
    console.log(doo); // prints daa1
});

// for debug you can listen to all events
flow.consume('*', evt => {
    console.log(`Event type: ${evt.name}, data: ${evt.data}`);
})
```

#### Join flows together

```js
const base = new Flow();
base.define('foo', 'bar')
const flow = new Flow(base);
flow.consume('foo', foo => {
    console.log(foo); // prints bar
});
```

You can also make them depend on each other

```js
const base = new Flow();
base.consume('shared', (_, rt) => {
    rt.define('foo', 'bar');
});
const flow = new Flow(base);
flow.consume('foo', foo => {
    console.log(foo); // prints bar
});
flow.define('shared', ''); // trigger the chain
```

#### Timeouts

The promise chain may be hard to figure out where it is blocked.
Oja allows to set a timeout for the given topics and upon the timeout would provide an error message listing topics that have not been resolved yet.

```js
flow
.consume('foo')
.consume('bar')
.consume('too')
.timeout(['foo', 'bar'], 300)   // 300 ms
.define('bar', 'boo')
.catch(err => {
    console.log(err.message); // prints "Topic/s (foo) timed out, pending topics (too)"
});
```

#### Querying for the state

Oja provides a current status of topcis that have not been resolved

```js
flow
.consume('foo')
.consume('bar')
.consume('too')
.define('bar', 'boo');

console.log(flow.state()); // prints [foo, too]
```

#### Error

##### Throwing error

```js
flow.define('error', new Error('Boom'));
// or
flow.define('error', Promise.reject(new Error('Boom')));
// or
flow.define('data', () => {
    return new Error('Boom');
});
// or
flow.define('data', runtime => {
    runtime.pub(new Error('Boom'));
});
```

##### Catching error

```js
flow.catch(err => {
    console.log(err);   // prints Boom if linked to the above flow
});
// Or
flow.consume('error', err => {
    console.log(err);   // prints Boom if linked to the above flow
});
```

##### Error stops flow

The error will prevent further events including error events from publishing.

```js
flow
.define('foo', 'faa')
.define('boo', 'baa')
.define('error', new Error('Boom'))
.define('too', 'taa')
.consume('foo', foo => {
    console.log(foo); // prints faa
})
.consume('boo', foo => {
    console.log(foo); // prints baa
})
.consume('too', too => {
    // will never happen
    throw new Error('Should never happen');
})
.catch(err => { // catch error
    console.log(err);   // print Boom
});
```
