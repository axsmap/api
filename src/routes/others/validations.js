const freemail = require('freemail');
const { isEmail } = require('validator');
const { isEmpty } = require('lodash');

module.exports = {
  validateContact(data) {
    const errors = {};

    if (typeof data.email === 'undefined' || data.email === '') {
      errors.email = 'Is required';
    } else if (typeof data.email !== 'string') {
      errors.email = 'Should be a string';
    } else if (data.email.length > 254) {
      errors.email = 'Should be less than 255 characters';
    } else if (!isEmail(data.email) || freemail.isDisposable(data.email)) {
      errors.email = 'Should be a valid email';
    }

    if (typeof data.message === 'undefined' || data.message === '') {
      errors.message = 'Is required';
    } else if (typeof data.message !== 'string') {
      errors.message = 'Should be a string';
    } else if (data.message.length > 999) {
      errors.message = 'Should be less than 1000 characters';
    }

    if (typeof data.name === 'undefined' || data.name === '') {
      errors.name = 'Is required';
    } else if (typeof data.name !== 'string') {
      errors.name = 'Should be a string';
    } else if (data.name.length > 60) {
      errors.name = 'Should be less than 61 characters';
    }

    return { errors, isValid: isEmpty(errors) };
  }
};
