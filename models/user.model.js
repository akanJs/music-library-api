const { Schema, model } = require('mongoose');


const userSchema = new Schema({
  name: {
    type: String,
    required: [1, 'username required']
  },
  email: {
    type: String,
    required: [1, 'user email is required']
  },
  password: {
    type: String,
    required: [1, 'user password is required']
  }
});

const User = model('User', userSchema);

module.exports = { User, userSchema };
