var ServiceB = module.exports = function () {
};

ServiceB.prototype.callA = function (cb) {
  log('callA');
  rpc.getService('ServiceA', function (e, ServiceA) {
    log('callA.getService');
    if (e)
      throw e;
    ServiceA.echo('Hello world!', function (e, reply) {
      log('callA.getService.echo');
      if (e)
        throw e;
      log('Reply is:', reply);
      cb();
    });
  });
};

ServiceB.prototype.test = function (cb) {
  cb();
};
