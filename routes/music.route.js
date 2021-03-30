// jshint esversion:8
const router = require('express').Router();
const AWS = require('aws-sdk');
const Busboy = require('busboy');
const axios = require('axios').default;
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const Ffmpeg = require('ffmpeg');
const { Sound } = require('../models/music.model');

const RECOGNITION_BASE_URI = 'https://api.audd.io/';
const RECOGNITION_API_KEY = 'a074be4a85f7add8edfc82ca574be904';

// Function to retrieve objects from bucket
function getAllMusic(res) {
  // S3 initialization
  const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ID,
    secretAccessKey: process.env.AWS_SECRET,
    Bucket: process.env.BUCKET_NAME
  });

  const params = {
    Bucket: process.env.BUCKET_NAME
  };

  // const location = s3.getBucketLocation();
  // console.log(location);

  s3.listObjects(params, (err, data) => {
    if (err) {
      console.log(err);
      return res.json({
        status: 'failed',
        message: 'music fetch failed',
        error: err.message
      });
    }

    return res.json({
      status: 'success',
      message: 'music fetch successful',
      data
    });
  });
}

// Function to upload to aws s3
async function uploadToS3(file, res) {
  // S3 initialization
  const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ID,
    secretAccessKey: process.env.AWS_SECRET,
    Bucket: process.env.BUCKET_NAME
  });


  // Upload parameters
  const params = {
    Bucket: process.env.BUCKET_NAME,
    Key: file.name,
    Body: file.data
  };

  return s3.upload(params).promise();
}


const routes = () => {

  // Get original sound page
  router.route('/original-sound/:id')
    .get(async (req, res) => {
      const sound_id = req.params.id;
      const sound = await Sound.findOne({ sound_id });
      if(sound) {
        return res.json({
          status: true,
          message: 'sound fetched successfully',
          sound
        });
      }
    });

  // Upload music endpoint
  router.route('/upload')
    .post((req, res) => {
      const user = {
        user_id: uuidv4(),
        name: 'Akanowo Uko',
        username: 'jsDev'
      };
      const video = {
        video_id: uuidv4(),
        video_url: 'url',
        posted_by: user,
        posted_date: moment().format('dddd, MMMM Do YYYY, h:mm:ss a')
      };
      console.log(req.files);
      const { music } = req.files;

      const allowedTypes = ['audio/mid', 'audio/mpeg', 'audio/mp4', 'audio/x-aiff'];
      let typeIsAllowed = false;
      for(let i = 0; i < allowedTypes.length; i++) {
        if(music.mimetype === allowedTypes[i]){
          typeIsAllowed = !typeIsAllowed;
        }
      }
      if(!typeIsAllowed) {
        return res.json({
          status: 'failed',
          error: 'extension not allowed'
        });
      }

      const duration = Number.parseInt(req.body.duration);
      console.log(typeof duration);
      // Check if duration is null, undefined or is not a number
      if (typeof duration !== 'number' || duration === null || duration === undefined) {
        return res.json({
          status: 'failed',
          message: 'duration must be a number'
        });
      }
      // Check the length of the duration
      if (duration > 14.999999) {
        return res.json({
          status: 'failed',
          message: 'max sound duration exceeded'
        });
      }

      // Handle file upload with busboy
      const busboy = new Busboy({ headers: req.headers });

      // Log file upload finished
      busboy.on('finish', async () => {
        // console.log(req.files.music);

        const result = await uploadToS3(req.files.music, res);
        if (result.Location) { // Validate s3 upload

          // check if song exists in db
          const isSongInDb = await Sound.findOne({ url: result.Location });
          if(isSongInDb) {
            return res.json({
              status: 'failed',
              error: 'Song exists'
            });
          }

          // Set music recognition api data
          const data = {
            'api_token': RECOGNITION_API_KEY,
            url: result.Location,
            return: 'apple_music,spotify'
          };
          // Post music data to recognition api
          const recognized_music = await axios.post(RECOGNITION_BASE_URI, data);
          console.log(recognized_music.data);
          let soundData;
          // Set sound data
          recognized_music.data.status === 'success' && recognized_music.data.result !== null ?
            soundData = {
              name: recognized_music.data.result.title + ' - ' + recognized_music.data.result.artist,
              url: result.Location,
              sound_id: uuidv4(),
              sound_artist: recognized_music.data.result.artist,
              original_sound: false,
              originated_by: {user: null},
              video_used_by: video,
              created_date: moment().format('dddd, MMMM Do YYYY, h:mm:ss a')
            } : soundData = {
              name: 'Original Sound',
              url: result.Location,
              sound_id: uuidv4(),
              sound_artist: user.username,
              original_sound: true,
              originated_by: {user},
              video_used_by: video,
              created_date: moment().format('dddd, MMMM Do YYYY, h:mm:ss a')
            };

          // create sound and store in db 
          const newSound = await Sound.create(soundData);
          newSound ? 
          res.json({
            status: 'success',
            message: 'upload to s3 successful',
            music: newSound
          }) : res.json({
            status: 'failed',
            message: 'could add sound to db',
            music: newSound
          });
        }
      });
      req.pipe(busboy);
    });

  // Get all music endpoint
  router.route('/all')
    .get(async (req, res) => {
      const sounds = await Sound.find();
      return res.json({
        status: 'success',
        message: 'sound fetch successful',
        sounds
      });
    });

  // Extract audio from video
  router.route('/extract')
    .post((req, res) => {
      const { video_url } = req.body;
      console.log(video_url);

      try {
        const videoProcess = new Ffmpeg(video_url);
        videoProcess.then(async (video) => {
          console.log(video.metadata);
          const extractedAudio = await video.fnExtractSoundToMP3('public/audio.mp3');
          return res.json({
            status: true,
            video_metadata: video.metadata,
            audioPath: extractedAudio
          })
        });
      } catch (error) {
        console.log(error);
        return res.json({
          status: false,
          error: error
        })
      }
    });

  return router;
};


module.exports = routes;