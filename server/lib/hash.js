const bcrypt = require('bcryptjs');

function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

function verifyPassword(password, stored) {
  return bcrypt.compareSync(password, stored);
}

module.exports = { hashPassword, verifyPassword };
