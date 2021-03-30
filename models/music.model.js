// jshint esversion:8
const { videoSchema, Video } = require('./video.model');
const { User } = require('./user.model');
const { Schema, model, Types } = require('mongoose');


const soundSchema = new Schema({
  name: { type: String, required: [1, 'sound name is required!'] },
  url: { type: String, required: [1, 'sound url is required'] },
  sound_id: {type: String, required: [1, 'sound unique id is required']},
  sound_artist: { type: String, required: [1, 'sound artist is required'] },
  original_sound: { type: Boolean, required: [1, 'specify if sound is original, true or false'] },
  originated_by: { type: Object, required: [1, 'originated_by is required']},
  video_used_by: { type: [Object], required: [1, 'video details is required'] },
  created_date: { type: String, default: null }
});

const Sound = model('Sound', soundSchema);

module.exports = { Sound };
