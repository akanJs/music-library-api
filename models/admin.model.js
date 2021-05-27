// jshint esversion:9
const { Schema, model } = require('mongoose');

const adminModel = new Schema({
  name: {
    type: String,
    required: true,
    max: 100
  },
  email: {
    type: String,
    required: true,
    max: 10
  },
  password: {
    type: String,
    required: true
  }
});

const Admin = model('Admin', adminModel);

module.exports = { Admin };
