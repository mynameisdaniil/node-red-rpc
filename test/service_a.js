var ServiceA = module.exports = function () {
};

ServiceA.prototype.echo = function (msg, cb) {
  log('echo', arguments);
  cb(null, 'ECHO: ' + msg);
};
