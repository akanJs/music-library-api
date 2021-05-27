// jshint esversion:9
const router = require('express').Router();
const {
  Playlist
} = require('../models/playlist.model');
const {
  Track
} = require('../models/track.model');
const Busboy = require('busboy');
const axios = require('axios').default;
const fs = require('fs');
const AWS = require('aws-sdk');
const uuidv4 = require('uuid').v4;
const moment = require('moment');
const {
  Video
} = require('../models/video.model');
const {
  OriginalSound
} = require('../models/originalSound.model');
const Ffmpeg = require('ffmpeg');

/*
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiI2MGFiOWU5OTlhYmQ0NTI0OGNiNjE3NDUiLCJpYXQiOjE2MjE4NTk5OTR9.7YMUA-FnKWldvXW5K-XD3evTSHj-5UhapIB-EPDPHbA
*/


/**
 * @param {fs.PathLike} filePath
 * @param {boolean} asBuffer
 * @param {function} cb
 */

const getBinary = (filePath, asBuffer = false, cb) => {
  let readStream = fs.createReadStream(filePath);
  let data = '';

  // set stream encoding to binary so chunks are kept in binary
  readStream.setEncoding('binary');
  readStream.once('error', err => {
    return cb(err, null);
  });
  readStream.on('data', chunk => {
    console.log(chunk);
    data += chunk;
  });
  readStream.on('end', () => {
    // If you need the binary data as a Buffer
    // create one from data chunks       
    return cb(null, asBuffer ? Buffer.from(data, 'binary') : data);
  });
};

/**
 * @param {string} sound_id
 * @param {{ video_id?: string; video_url?: string; posted_by?: { user_id: string; name: string; username: string; }; posted_date?: string; sound?: any; }} video_data
 */
async function createSoundAndVideoInDb(sound_id, video_data) {
  try {
    video_data.sound = sound_id;
    console.log(video_data);
    const video = await Video.create(video_data);
    if (!video) {
      return false;
    }
    return true;
  } catch (error) {
    console.log(error.message);
    return false;
  }
}

// Function to upload to aws s3
/**
 * @param {{ name: string; data: Buffer; }} file
 */
async function uploadToS3(file) {
  // S3 initialization
  const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ID,
    secretAccessKey: process.env.AWS_SECRET,
    // @ts-ignore
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

/**
 * @param {string} mimeType
 * @param {string} type
 */
function validateMediaType(mimeType, type) {
  const allowedSoundTypes = ['audio/mid', 'audio/mpeg', 'audio/mp4', 'audio/x-aiff'];
  const allowedVideoTypes = ['video/mp4', 'video/mpeg', 'video/ogg', 'video/quicktime'];

  if (type === 'audio') {
    let soundTypeIsAllowed = false;
    for (let i = 0; i < allowedSoundTypes.length; i++) {
      if (mimeType === allowedSoundTypes[i]) {
        soundTypeIsAllowed = !soundTypeIsAllowed;
      }
    }
    return soundTypeIsAllowed;
  }

  if (type === 'video') {
    let videoTypeIsAllowed = false;
    // check video format
    for (let i = 0; i < allowedVideoTypes.length; i++) {
      if (mimeType === allowedVideoTypes[i]) {
        videoTypeIsAllowed = !videoTypeIsAllowed;
      }
    }
    return videoTypeIsAllowed;
  }
}

/**
 * @param {any[]} filePaths
 * @param {(err: NodeJS.ErrnoException, message: string) => void} cb
 */
function deleteFiles(filePaths, cb) {
  filePaths.forEach(( /** @type {fs.PathLike} */ path) => {
    fs.rm(path, (err) => {
      if (err) {
        console.log('could not delete file: ', err);
        return cb(err, 'could not delete file');
      }
      return cb(null, 'file deleted sucessfully');
    });
  });
}

const routes = () => {

  router.route('/music/library')
    .get((req, res) => {
      return res.render('client-library');
    });

  router.route('/get-all-sounds')
    .get(async (req, res) => {
      try {
        // find all music in db
        const playlists = await Playlist.find();
        const categories = [];
        if (playlists.length > 0) {
          for (let playlist of playlists) {
            // @ts-ignore
            const category = playlist.playlist_name;
            const tracks = await Track.find({
              playlist_id: playlist._id
            });
            categories.push({
              category,
              songs: tracks
            });
          }
          return res.status(200).json({
            status: true,
            categories
          });
        }
        return res.status(200).json({
          status: true,
          categories
        });
      } catch (error) {
        console.log(error);
        return res.status(500).json({
          status: false,
          error: 'an error occured'
        });
      }
    });

  router.route('/get-song/:id')
    .get(async (req, res) => {
      const {
        id
      } = req.params;
      try {
        const song = await Track.findOne({
          track_id: id
        }); // find song in db
        if (song) {
          console.log('song id', song._id);
          return res.status(200).json({
            status: true,
            // @ts-ignore
            url: song.track_preview_url
          });
        }
      } catch (error) {
        console.log('error in try catch: ', error.message);
        return res.status(500).json({
          status: false,
          error: 'an error occured'
        });
      }
    });

  router.route('/upload-video')
    .get(async (req, res) => {
      // get id from request query
      return res.render('upload');
    })
    .post(async (req, res) => {
      const busboy = new Busboy({
        headers: req.headers
      });

      const user = {
        user_id: uuidv4(),
        name: 'Akanowo Uko',
        username: 'jsDev'
      };

      const {
        video,
        sound
        // @ts-ignore
      } = req.files;

      console.log('Sound: ', sound, '\n', 'Video: ', video);

      if (!video) {
        return res.status(400).json({
          status: false,
          error: 'no video received'
        });
      }

      // validate audio and video mimetype
      const isSoundValid = sound ? validateMediaType(sound.mimetype, 'audio') : null;
      const isVideoValid = validateMediaType(video.mimetype, 'video');

      if ((sound && !isSoundValid) || !isVideoValid) {
        return res.status(422).json({
          status: false,
          error: 'unsupported media type'
        });
      }

      // console.log(req.files.music);
      const videoPath = `public/${video.name}`;
      const videoCreated = !sound ? fs.writeFile(videoPath, video.data, (err) => {
        if (err) {
          console.log('an error occured in creating the video: ', err);
          return;
        }
      }) : false;

      // upload video and audio to s3
      const audioResult = sound ? await uploadToS3(sound) : null;
      const videoResult = await uploadToS3(video);
      if ((audioResult && audioResult.Location) || (videoResult && videoResult.Location)) { // Validate s3 upload
        // Set music recognition api data
        const data = sound ? {
          'api_token': process.env.MUSIC_RECOGNITION_API_KEY,
          url: audioResult.Location,
          return: 'spotify'
        } : null;

        const video_data = {
          video_id: uuidv4(),
          video_url: videoResult.Location,
          video_mimetype: video.mimetype,
          posted_by: user,
          posted_date: moment().format('dddd, MMMM Do YYYY, h:mm:ss a')
        };

        if (sound) {
          // Post music data to music recognition api
          const recognized_music = await (await axios.post('https://api.audd.io/', data)).data;
          try {
            if (recognized_music.status === 'success' && recognized_music.result !== null) {
              // find song in db
              console.log(recognized_music);
              const trackExists = await Track.findOne({
                track_id: recognized_music.result.spotify.id
              });
              if (trackExists) {
                const dataCreated = await createSoundAndVideoInDb(trackExists._id, video_data);
                if (dataCreated) {
                  return res.status(201).json({
                    status: true,
                    message: 'post created successfully'
                  });
                }
                return res.status(500).json({
                  status: false,
                  message: 'post upload failed'
                });
              }
              const original_sound_data = {
                name: `Original Sound - Unknown`,
                url: audioResult.Location,
                sound_id: uuidv4(),
                sound_artist: user.username,
                original_sound: true,
                originated_by: user,
                created_by: moment().format('dddd, MMMM Do YYYY, h:mm:ss a')
              };
              const original_sound = await OriginalSound.create(original_sound_data);
              if (original_sound) {
                await createSoundAndVideoInDb(original_sound._id, video_data) ?
                  res.status(201).json({
                    status: true,
                    message: 'post created successfully'
                  }) : res.status(500).json({
                    status: false,
                    message: 'post upload failed'
                  });
                return;
              }
              return res.status(500).json({
                status: false,
                message: 'post upload failed'
              });
            }
            const original_sound_data = {
              name: `Original Sound - Unknown`,
              url: audioResult.Location,
              sound_id: uuidv4(),
              sound_artist: user.username,
              original_sound: true,
              originated_by: user,
              created_by: moment().format('dddd, MMMM Do YYYY, h:mm:ss a')
            };
            const original_sound = await OriginalSound.create(original_sound_data);
            if (original_sound) {
              await createSoundAndVideoInDb(original_sound._id, video_data) ?
                res.status(201).json({
                  status: true,
                  message: 'post created successfully'
                }) : res.status(500).json({
                  status: false,
                  message: 'post upload failed'
                });
              return;
            }
            return res.status(500).json({
              status: false,
              message: 'post upload failed'
            });
          } catch (error) {
            if (error.response) {
              console.log(error.response.data);
            }
            console.log(error.message);
            return res.status(500).json({
              status: true,
              error: error.message
            });
          }
        }

        try { // sound was not added
          // extract sound from video
          console.log('in video try catch');
          const videoObject = await new Ffmpeg(videoPath); // create new video object with Ffmpeg
          const audioName = video.name.replace('.mp4', '_audio.mp3');
          const audioPath = `public/${audioName}`;
          videoObject.fnExtractSoundToMP3(audioPath).then(async (videoAudio) => {
            console.log('video audio extracted');
            // extract audio from video
            const buffer = fs.readFileSync(videoAudio);
            console.log('video audio buffer: ', buffer);
            const sound_data = {
              name: audioName,
              data: buffer
            };
            const audioUpload = await uploadToS3(sound_data);
            console.log('Audio buffer', buffer);
            if (audioUpload.Location) {
              console.log(audioUpload);
              console.log('upload to s3 successful');
              // delete audio and video
              deleteFiles([videoPath, audioPath], async (err, message) => {
                if (err) {
                  return res.status(422).json({
                    status: false,
                    error: err.message
                  });
                }
                console.log(message);
                // save data to db
                const soundData = {
                  name: `Original Sound - ${user.username}`,
                  url: audioUpload.Location,
                  sound_id: uuidv4(),
                  sound_artist: user.username,
                  original_sound: true,
                  originated_by: user,
                  contains_sound_from: '',
                  created_date: moment().format('dddd, MMMM Do YYYY, h:mm:ss a')
                };

                // find song in db and library
                const recognizion_data = {
                  'api_token': process.env.MUSIC_RECOGNITION_API_KEY,
                  url: audioUpload.Location,
                  return: 'spotify'
                };
                const recognized_music = await (await axios.post('https://api.audd.io/', recognizion_data)).data;
                console.log(recognized_music);

                if (recognized_music.status === 'error') {
                  return res.status(500).json({
                    status: false,
                    error: 'an error occured'
                  });
                }

                if (recognized_music.status && recognized_music.result !== null) {
                  soundData.contains_sound_from = recognized_music.result.spotify.name;
                  // create new audio in db
                  const new_sound = await OriginalSound.create(soundData);
                  if (await createSoundAndVideoInDb(new_sound._id, video_data)) {
                    return res.status(201).json({
                      status: true,
                      message: 'post created successfully'
                    });
                  }
                  return;
                }
                // create new audio in db
                const new_sound = await OriginalSound.create(soundData);
                if (await createSoundAndVideoInDb(new_sound._id, video_data)) {
                  return res.status(201).json({
                    status: true,
                    message: 'post created successfully'
                  });
                }
              });
            }
          }).catch((error) => {
            console.log(error);
            return res.status(500).json({
              status: false,
              error: error.message
            });
          });
        } catch (error) {
          console.log(error.message);
          return res.status(500).json({
            status: false,
            error: 'an error occured'
          });
        }
      }
      req.pipe(busboy);
    });

  return router;
};

module.exports = routes;