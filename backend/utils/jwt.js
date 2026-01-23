'use strict';

const jwt = require('jsonwebtoken');

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || typeof secret !== 'string' || secret.trim().length < 16) {
    const err = new Error('JWT_SECRET is not set or too short (min 16 chars).');
    err.status = 500;
    throw err;
  }
  return secret;
}

function signToken(user, options = {}) {
  if (!user || !user.id) {
    const err = new Error('Cannot sign token: missing user.id');
    err.status = 500;
    throw err;
  }

  const payload = {
    sub: String(user.id),
    email: user.email ? String(user.email) : undefined,
    name: user.name ? String(user.name) : undefined
  };

  const secret = getJwtSecret();
  const expiresIn = options.expiresIn || process.env.JWT_EXPIRES_IN || '30d';
  return jwt.sign(payload, secret, { algorithm: 'HS256', expiresIn });
}

function verifyToken(token) {
  const secret = getJwtSecret();
  return jwt.verify(token, secret, { algorithms: ['HS256'] });
}

module.exports = {
  signToken,
  verifyToken
};
