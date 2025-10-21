const mongoose = require('mongoose');

const objectId = (value, helpers) => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    return helpers.message('"{#label}" must be a valid mongo id');
  }
  return value;
};

const password = (value, helpers) => {
  if (!value.match(/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d!@#$%^&*()_+\-=]{8,}$/)) {
    return helpers.message('"{#label}" must contain at least 8 characters, including letters and numbers');
  }
  return value;
};

module.exports = {
  objectId,
  password,
};
