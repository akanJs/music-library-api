// jshint esversion:9
const { Schema, model, Types } = require('mongoose');

const refreshTokenSchema = new Schema({
  admin_id: {
    type: Types.ObjectId,
    required: true
  },
  refresh_token: {
    type: String,
    required: true
  }
});

const RefreshToken = model('RefreshToken', refreshTokenSchema);

module.exports = { RefreshToken };