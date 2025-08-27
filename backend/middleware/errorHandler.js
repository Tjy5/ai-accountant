'use strict'

module.exports = function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  const payload = {
    error: err.message || '服务器内部错误'
  };
  if (process.env.NODE_ENV !== 'production' && err.stack) {
    payload.stack = err.stack;
  }
  if (err.details) {
    payload.details = err.details;
  }
  res.status(status).json(payload);
};


