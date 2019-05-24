const util = require('util');

const Flow = require('.').Flow;

/**
 * Options can be used to define mock or custom context methods or values
 * The function must be of the following signature "context => (args) => value",
 * which is function factory with injected context that will be created by
 * runtime and passed to every factory function before execution of the returned function instance
 */
module.exports = (options = {}) => {
    const { functions = {}, properties = {} } = options;
    // create access route as context.functionGroup.action(request) => response
    const proxy = new Proxy(new Flow(), {
        get(obj, domainName) {
            // use action domain as an indication of action context injected or
            // not if missing in actionDomain while present in functions
            // in this case we will run action factory
            const ret = obj[domainName] = obj[domainName] || new Proxy({
                functionDomain: (functions[domainName] ? {} : undefined),
                propDomain: properties[domainName] || {},
                [util.inspect.custom]() {
                    return this.functionDomain || this.propDomain;
                },
                toJSON() {
                    return this.functionDomain || this.propDomain;
                }
            }, {
                get(obj, name) {
                    if (obj[name]) {
                        return obj[name];
                    }
                    if (obj.functionDomain) {
                        const value = obj.functionDomain[name] = obj.functionDomain[name] || create();
                        return value;
                    }

                    return obj.propDomain[name];

                    function create() {
                        const act = functions[domainName][name];
                        if (act instanceof Function) {
                            return act(proxy);
                        }
                        if (act instanceof Error) {
                            return () => {
                                throw act;
                            };
                        }
                        return () => act;
                    }
                }
            });
            return ret;
        }
    });

    return proxy;
};
