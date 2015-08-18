log = console.log;
ins = require('util').inspect;
var RedRpc = require('../index.js');
var yaff  = require('yaff');
var uuid  = require('uuid').v4;

rpc = new RedRpc({});

var sb = require('./service_b');

var descriptor_b = {
  name: 'ServiceB',
  methods: [
    'callA',
    'test'
  ]
};

yaff()
  .seq(function () {
    rpc.publishService(descriptor_b, new sb(), this);
  })
  .finally(function (e) {
    log(ins(arguments));
  });

// yaff()
//   .seq(function () {
//     rpc.publishService(descriptor, this);
//   })
//   .seq(function () {
//     rpc.listServices(this);
//   })
//   .seq(function () {
//     rpc.getService('test', this);
//   })
//   .finally(function (e) {
//     if (e) throw e;
//     log(ins(arguments));
//   })
