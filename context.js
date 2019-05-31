'use strict';

const Flow = require('.').Flow;

/**
 * Options can be used to define mock or custom context methods or values
 * The function must be of the following signature "context => (args) => value",
 * which is function factory with injected context that will be created by
 * runtime and passed to every factory function before execution of the returned function instance
 */
class Context extends Flow {
    constructor({ functions = {}, properties = {} }) {
        super();
        Object.assign(this, properties);
        Object.keys(functions).forEach(domainName => {
            const domainFunctions = functions[domainName];
            this[domainName] = {};
            Object.keys(domainFunctions).forEach(name => {
                const act = domainFunctions[name];
                this.create(domainName, name, act);
            });
        });
    }

    create(domainName, name, act) {
        let resolvedAct;
        const resolveAct = () => {
            if (act instanceof Function) {
                act = act(this);
                if (act instanceof Function) {
                    return act;
                }
            }
            if (act instanceof Error) {
                return () => {
                    throw act;
                };
            }
            return () => act;
        };

        Object.defineProperty(this[domainName], name, {
            get() {
                resolvedAct = resolvedAct !== undefined ? resolvedAct : resolveAct();
                return resolvedAct;
            },
            enumerable: true
        });
    }
}

module.exports = (options = {}) => new Context(options);
