// jshint esversion:8
const { Schema, model } = require('mongoose');


const originalSoundSchema = new Schema({
  name: { type: String, required: [1, 'sound name is required!'] },
  url: { type: String, required: [1, 'sound url is required'] },
  sound_id: {type: String, required: [1, 'sound unique id is required']},
  sound_artist: { type: String, required: [1, 'sound artist is required'] },
  original_sound: { type: Boolean, required: [1, 'specify if sound is original, true or false'] },
  originated_by: { type: Object, required: [1, 'originated_by is required']},
  contains_sound_from: { type: String, required: false, max: 100 },
  created_date: { type: String, default: null }
});

const OriginalSound = model('OriginalSound', originalSoundSchema);

module.exports = { OriginalSound };
