'use strict';

const Assert = require('assert');
const Oja = require('..');
const Flow = Oja.Flow;
const Action = Oja.Action;

describe(__filename, () => {
    beforeEach(() => {
        process.removeAllListeners('unhandledRejection');
        process.once('unhandledRejection', err => {
            throw new Error('Detected unhandled promise rejecttion for error:' + err.message);
        });
    });

    it('should catch timeout arror in try/catch async flow', next => {
        const runIt = async function () {
            try {
                await new Flow()
                .timeout('foo', 20)
                .consume(['foo']);
            } catch (e) {
                Assert.equal('Topic/s (foo) timed out, pending topics (none), queue state {}', e.message);
                next();
            }
        }

        runIt();
    });

    it('should catch timeout arror in try/catch async flow, action chain', next => {
        const runIt = async function () {
            const action = new Action();
            const other = new Action()
                .timeout('foo', 1);

            action.add(other);

            try {
                await action
                .activate()
                .consume(['foo']);
            } catch (e) {
                Assert.equal('Topic/s (foo) timed out, pending topics (none), queue state {}', e.message);
                next();
            }
        }

        runIt();

    });
});
