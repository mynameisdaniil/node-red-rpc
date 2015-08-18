log = console.log;
ins = require('util').inspect;
var RedRpc = require('../index.js');
var yaff  = require('yaff');
var uuid  = require('uuid').v4;

rpc = new RedRpc({});

var sa = require('./service_a');

var descriptor_a = {
  name: 'ServiceA',
  methods: [
    'echo'
  ]
};

yaff()
  .seq(function () {
    rpc.publishService(descriptor_a, new sa(), this);
  })
  .seq(function () {
    rpc.getService('ServiceB', this);
  })
  .seq(function (ServiceB) {
    ServiceB.callA(this);
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
