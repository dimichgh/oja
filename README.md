<p align="center">
    <img src="https://github.com/trooba/branding/raw/master/images/oja.png" alt="Oja logo" width="200" /><br /><br />
</p>

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

### API

* **Flow**([baseFlow]) creates a flow object
    * *baseFlow* is an optional base flow that would be joined with a new flow.

* **consume**(topics[, callback]) adds a consumer to the flow for the given topic or topics
    * *topics* is one or more topics to capture by the handler
    * **callback**((data|map), flow) is a handler, if provided, it will be called once all topics are resolved
        * *data* resolved for the single topic
        * *map* of resolved data mapped to corresponding topics
        * *flow* is an instance of the flow for convenience
    * **returns** promise or a list of promises if callback is not provided;
        * *promise* for single topic  
        * *promises* mapped to the provided topics

* **consumeStream**(topic[, callback]) returns a readable stream of events for the given topic
    * *Note:* if callback is provided, it will return a stream to the callback(stream) and continue cascading flow by returning 'this' reference;

* **define**(topics[, data|promise|function]) defines a producer for the given topic or an array of topics
    * *topics* is a single topic or an array of topics to broadcast the data with.
    * *data* will be immediately published under the given topics into the flow; in case an error object is passed, the flow will be stopped and an 'error' event will be broadcasted into the flow.
    * *promise* will publish data once resolved; in case of reject, the flow will be stopped and an 'error' event will be broadcasted into the flow.
    * **function**(publisher, flow) will be called immediately
        * *publisher* is a convenience object to publish events for the assigned topic in async use-case
        * *flow* is an instance of the current flow.
        * if *function* returns a non-undefined value, it will be published under the assigned topic immediately; this is useful in a sync flow.

* **on**(topic, callback) adds a listener for the given topic.
* **once**(topic, callback) adds a listener for the given topic that will be called for the fist event.
* **catch**(callback) adds an error handler to the flow. If no handlers are registered, it will re-throw the error.
* **timeout**(topics, ms) sets a timeout for the topic or and array of topics. The timeout error will be generated if the topic(s) are not resolved within the specified period of time (in milliseconds)
* **state**() returns a list of topics and their state (topics queue, pending topics)

* **Publisher** API is a convenience object to publish events for the assigned topic
    * **pub**(data|promise)
        * *data* will be immediately published under the given topics into the flow; in case error object is passed, the flow will be stopped and 'error' event will be broadcasted into the flow.
        * *promise* will publish data once resolved; in case of reject the flow will be stopped and 'error' generated.

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

#### Consuming multiple events for the given topic

```js
// create consumer component
flow
.consume('foo', foo => {
    console.log(foo); // prints 'bar1' and 'bar2'
})
// generate events
.define('foo', 'bar1')
.define('foo', 'bar2');
```

#### Consuming events as a stream

```js
const buffer = [];
// create consumer stream
const stream = flow.consumeStream('foo');
stream.on('data', data => buffer.push(data));
stream.on('end', () => {
    console.log(buffer); // prints one, two, three
})
// generate some data
flow.define('foo', 'one');
flow.define('foo', 'two');
flow.define('foo', 'three');
flow.define('foo', null);
```

#### Consuming multiple topics in one short

```js
// consume multiple topics
flow.consume(['foo', 'qoo'], input => {
    console.log(input.foo);     // prints faa
    console.log(input.qoo);     // prints qaa
});
flow.define('foo', 'faa');
flow.define('qoo', 'qaa');
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
.define('doo', publisher => {
    publisher.pub('daa1');
    publisher.pub('daa2');
    publisher.pub('daa3');
    publisher.pub(null);
})
.consume('doo', doo => {
    console.log(doo); // prints daa1, daa2, daa3, null
});
.consumeStream('doo', stream => {
    stream.on('data', console.log) // prints daa1, daa2, daa3
    stream.on('end', () => console.log('end of "doo"'));    
})
// NOTE: we can consume first event via promise if we are not interested in the rest
.consume('doo').then(doo => {
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
