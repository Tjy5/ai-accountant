'use strict'

module.exports = function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  const isProd = process.env.NODE_ENV === 'production';
  const payload = {
    error: err.message || '服务器内部错误'
  };
  if (!isProd && err.stack) {
    payload.stack = err.stack;
  }
  if (!isProd && err.details) {
    payload.details = err.details;
  }
  res.status(status).json(payload);
};


