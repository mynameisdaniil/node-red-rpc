var ServiceA = module.exports = function () {
};

ServiceA.prototype.echo = function (msg, cb) {
  log('echo');
  rpc.getService('ServiceB', function (e, ServiceB) {
    log('echo.getService');
    if (e)
      throw e;
      cb(null, 'ECHO: ' + msg);
    // ServiceB.test(function (e) {
    //   log('echo.getService.test');
    //   if (e)
    //     throw e;
    //   cb(null, 'ECHO: ' + msg);
    // });
  });
};
