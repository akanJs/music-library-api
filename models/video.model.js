const { Schema, model, Types } = require('mongoose');

const videoSchema = new Schema({
  video_id: {
    type: String,
    required: [1, 'video id is required']
  },
  video_url: {
    type: String,
    required: [1, 'video url is required']
  },
  video_mimetype: {
    type: String,
    required: [1, 'video mimetype is required']
  },
  posted_by: {
    type: Object,
    required: [1, 'posted by is required']
  },
  posted_date: {
    type: String,
    required: true
  },
  sound: {
    type: Types.ObjectId,
    ref: 'Sound',
  }
});

const Video = model('Video', videoSchema);

module.exports = { Video, videoSchema };
