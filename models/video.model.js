const { Schema, model } = require('mongoose');

const videoSchema = new Schema({
  video_id: {
    type: String,
    required: [1, 'video id is required']
  }
});

const Video = model('Video', videoSchema);

module.exports = { Video, videoSchema };
