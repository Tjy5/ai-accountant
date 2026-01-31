'use strict';

const jwt = require('jsonwebtoken');

function getJwtSecret() {
  const raw = process.env.JWT_SECRET;
  const secret = typeof raw === 'string' ? raw.trim() : '';
  if (secret) return secret;

  const isProd = process.env.NODE_ENV === 'production';
  if (isProd) {
    throw new Error('JWT_SECRET is required in production.');
  }

  return 'fallback_secret_for_dev_123456_do_not_use_in_prod';
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
