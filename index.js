var redis     = require('redis');
var yaff      = require('yaff');
var uuid      = require('uuid').v4;
var serialize = JSON.stringify;
var parse     = JSON.parse;

var log = console.log; //jshint ignore:line
var err = console.error; //jshint ignore:line
var ins = require('util').inspect; //jshint ignore:line

var SERVICE_INDEX_NAME   = 'services';
var METHOD_INDEX_PREFIX  = 'methods:';
var TASKS_QUEUE_PREFIX   = 'tasks:';
var RUNNING_QUEUE_PREFIX = 'running:';
var RESULTS_QUEUE_PREFIX = 'results:';

var RedRpc = module.exports = function (opts) {
  opts = opts || {};
  this.redis         = redis.createClient(opts);
  this.opts          = opts;
  this.timeout       = opts.timeout || 10000;
  this.prefix        = opts.prefix || 'rpc:';
  this.runtime_id    = opts.runtime_id || uuid();
  this.service_cache = {};
  this.callbacks     = {};
  this.to_listen     = [this.prefix + RESULTS_QUEUE_PREFIX + this.runtime_id];
  this._listen();
};

var non_empty = function (item) { return !!item; };

RedRpc.prototype._listen = function () {
  var self = this;
  // log('to_listen', this.to_listen);
  yaff(this.to_listen)
    .parMap(function (key) {
      self.redis.lpop(key, this);
    })
    .flatten()
    .map(JSON.parse)
    .filter(non_empty)
    .parMap(function (item) {
      log('item:', item);
      if (item.service) 
        self._processCall(item, this);
      else
        self._processCB(item, this);
    })
    .finally(function () {
      setImmediate(function () {
        self._listen();
      });
    });
};

RedRpc.prototype._processCB = function (item, cb) {
  log('!!!!!');
  var cb_obj = this.callbacks[item.corr_id];
  if (cb_obj) {
    clearTimeout(cb_obj.timeout);
    cb_obj.cb.apply(cb_obj.cb, item.args);
  }
  cb();
};

RedRpc.prototype._processCall = function (call_obj, cb) {
  var self = this;
  var service = this.service_cache[call_obj.service];
  if (service) {
    var method = service[call_obj.method];
    if (method) {
      return method.apply(service, call_obj.args.concat(function () {
        log('Calling callback', call_obj.corr_id);
        var args = Array.prototype.slice.call(arguments);
        var ret_obj = {corr_id: call_obj.corr_id, args: args};
        self.redis.lpush(self.prefix + RESULTS_QUEUE_PREFIX + call_obj.runtime_id, serialize(ret_obj), cb);
      }));
    }
  }
  cb();
};

RedRpc.prototype.publishService = function (descriptor, instance, cb) {
  var self = this;
  var service_name = descriptor.name;
  this.service_cache[service_name] = instance;
  if (this.to_listen.indexOf(this.prefix + TASKS_QUEUE_PREFIX + service_name) == -1) {
    this.to_listen.push(this.prefix + TASKS_QUEUE_PREFIX + service_name);
  }
  yaff().par(function () {
      self.redis.sadd(self.prefix + SERVICE_INDEX_NAME, [service_name], this);
    }).par(function () {
      self.redis.sadd(self.prefix + METHOD_INDEX_PREFIX + service_name, descriptor.methods, this);
    }).finally(cb);
};

RedRpc.prototype.getService = function (service_name, cb) {
  var self = this;
  if (this.service_cache[service_name])
    return cb(null, this.service_cache[service_name]);
  yaff()
    .seq(function () {
      self.redis.sismember(self.prefix + SERVICE_INDEX_NAME, service_name, this);
    })
    .seq(function () {
      self.redis.smembers(self.prefix + METHOD_INDEX_PREFIX + service_name, this);
    })
    .flatten()
    .reduce(function (service, method_name) {
      if(!service)
        service = (new Function('return function ' + service_name + '(){}'))(); //jshint ignore:line
      service.prototype[method_name] = self._createCallWrapper(service_name, method_name);
      return service;
    }, undefined)
    .apply(function (Service) {
      self.service_cache[service_name] = new Service();
      return self.service_cache[service_name];
    })
    .finally(cb);
};

RedRpc.prototype.listServices = function (cb) {
  this.redis.smembers(this.prefix + SERVICE_INDEX_NAME, cb);
};

var createTimeout = function (timeout, id, service_name, method_name, cache) {
  return setTimeout(function () {
    var cb = cache[id].cb;
    delete cache[id];
    cb(new Error(service_name + '.' + method_name + '() is timed out'));
  }, timeout);
};

RedRpc.prototype._createCallWrapper = function (service_name, method_name) {
  var self = this;
  return function () {
    if (!arguments.length)
      throw new Error('There should be callback at least');
    var args    = Array.prototype.slice.call(arguments, 1);
    var cb      = arguments[arguments.length - 1];
    var corr_id = uuid();
    var timeout = createTimeout(self.timeout, corr_id, service_name, method_name, self.callbacks);
    var cb_obj  = {cb: cb, timeout: timeout};
    var call_obj = {runtime_id: self.runtime_id, corr_id: corr_id, service: service_name, method: method_name, args: args};
    self.callbacks[corr_id] = cb_obj;
    self.redis.lpush(self.prefix + TASKS_QUEUE_PREFIX + service_name, serialize(call_obj), function (e) {
      if (e) {
        clearTimeout(timeout);
        delete self.callbacks[corr_id];
        cb(e);
      }
      //do something (?)
    });
  };
};
