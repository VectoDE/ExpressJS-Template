const roles = ['user', 'admin'];

const roleRights = new Map([
  ['user', ['getProfile']],
  ['admin', ['getProfile', 'manageUsers']],
]);

module.exports = {
  roles,
  roleRights,
};
