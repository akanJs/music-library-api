const { Schema, model, Types } = require('mongoose');

const playlistSchema = new Schema({
  playlist_id: {
    type: String,
    required: true
  },
  playlist_snapshot_id: {
    type: String,
    required: true
  },
  playlist_name: {
    type: String,
    required: true
  },
  playlist_uri: {
    type: String,
    required: true
  },
  playlist_tracks: {
    type: Object,
    required: true
  }
});

const Playlist = model('Playlist', playlistSchema);

module.exports = { Playlist, playlistSchema };
