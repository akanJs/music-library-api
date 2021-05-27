// jshint esversion:9
const { Schema, model, Types } = require('mongoose');

const trackSchema = new Schema({
  track_id: {
    type: String,
    required: true
  },
  track_name: {
    type: String,
    required: true
  },
  track_artists: {
    type: [Object],
    required: true
  },
  track_images: {
    type: Array
  },
  track_preview_url: {
    type: String,
  },
  track_uri: {
    type: String,
    required: true
  },
  playlist_id: {
    type: Types.ObjectId,
    required: true
  }
});

const Track = model('Track', trackSchema);

module.exports = { Track, trackSchema };
