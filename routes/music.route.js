// jshint esversion:9
const router = require('express').Router();
const AWS = require('aws-sdk');
const Busboy = require('busboy');
const axios = require('axios').default;
const {
  v4: uuidv4
} = require('uuid');
const moment = require('moment');
const Ffmpeg = require('ffmpeg');
const {
  OriginalSound
} = require('../models/originalSound.model');
const {
  Video
} = require('../models/video.model');

const { Playlist } = require('../models/playlist.model');
const { Track } = require('../models/track.model');
const fs = require('fs');
const queryString = require('querystring');
const requiredLogin = require('../middleware/requiredLogin');

const RECOGNITION_BASE_URI = 'https://api.audd.io/';
const RECOGNITION_API_KEY = process.env.MUSIC_RECOGNITION_API_KEY;

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


function deleteFiles(filePaths) {
  filePaths.forEach((path) => {
    fs.rm(path, (err) => {
      if (err) {
        console.log('could not delete file: ', err);
        return;
      }
      console.log('file deleted sucessfully');
    });
  });
}

// Function to upload to aws s3
async function uploadToS3(file) {
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


async function createSoundAndVideoInDb(song, buffer, video_data, res) {
  console.log('passed song data: ', song);
  let soundData = {};
  const artists = [];
  for (let artist of song.track ? song.track.album.artists : song.album.artists) {
    artists.push(artist.name);
  }
  console.log('Artists: ', artists);
  console.log(song);
  const s3_upload_data = {
    name: song.track ? song.track.name : song.name,
    data: buffer
  };
  const songUrl = song.preview_url && song.preview_url !== '' ? song.preview_url : song.track ? song.track.preview_url === null ? await (await uploadToS3(s3_upload_data)).Location : song.track.preview_url : await (await uploadToS3(s3_upload_data)).Location;
  console.log('songUrl: ', songUrl);
  soundData = {
    name: song.track ? song.track.name + ' - ' + artists.join(' , ') : song.name + ' - ' + artists.join(' , '),
    sound_artist: artists.join(' , '),
    url: songUrl,
    sound_id: uuidv4(),
    original_sound: false,
    originated_by: {
      user: null
    },
    created_date: moment().format('dddd, MMMM Do YYYY, h:mm:ss a')
  };
  const newSound = await OriginalSound.create(soundData);
  if (newSound) {
    video_data.sound = newSound._id;
    // replace with how you store video data
    const newVideo = await (await Video.create(video_data)).execPopulate('sound');
    const responseData = {
      message: 'new video created',
      video: newVideo
    };
    newVideo ?
      res.json({
        status: 'success',
        data: responseData
      }) : res.json({
        status: 'failed',
        message: 'could add video and sound to db',
        music: newVideo
      });
    return;
  }
}

const routes = () => {

  // Get original sound page
  router.route('/song/:id')
    .get(async (req, res) => {
      const track_id = req.params.id;
      const song = await Track.findOne({
        track_id
      });
      if (song) {
        return res.json({
          status: true,
          message: 'sound fetched successfully',
          song
        });
      }
    });


  router.route('/search')
    .get(requiredLogin, async (req, res) => {
      const { key, access_token } = req.query;
      const type = 'track';

      if (!key || !access_token) {
        res.status(400);
        return res.json({
          status: false,
          error: 'missing key or access_token'
        });
      }
      const data = {
        headers: {
          Authorization: `Bearer ${access_token}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      };

      const params = queryString.stringify({
        q: key,
        type
      });
      try {
        const response = await (await axios.get(`https://api.spotify.com/v1/search?${params}`, data)).data;
        console.log(response);
        return res.status(200).json({
          status: true,
          data: response
        });
      } catch (error) {
        if (error.response) {
          console.log(error.response.data);
          return res.status(500).json({
            status: false,
            error: 'an error occured'
          });
        }
        console.log(error);
        return res.status(500).json({
          status: false,
          error: 'an error occured'
        });
      }
    });

  // Upload music endpoint
  router.route('/upload')
    .get(async (req, res) => {
      return res.render('upload');
    })
    .post(requiredLogin, (req, res) => {
      const busboy  = new Busboy({
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
      } = req.files;

      if (!video) {
        return res.status(400).json({
          status: false,
          error: 'no video received'
        });
      }

      const allowedSoundTypes = ['audio/mid', 'audio/mpeg', 'audio/mp4', 'audio/x-aiff'];
      const allowedVideoTypes = ['video/mp4', 'video/mpeg', 'video/ogg', 'video/quicktime'];

      // sound added to video
      if (sound) {
        let soundTypeIsAllowed = false;
        for (let i = 0; i < allowedSoundTypes.length; i++) {
          if (sound.mimetype === allowedSoundTypes[i]) {
            soundTypeIsAllowed = !soundTypeIsAllowed;
          }
        }
        if (!soundTypeIsAllowed) {
          return res.json({
            status: 'failed',
            error: 'sound format not supported'
          });
        }
      }

      let videoTypeIsAllowed = false;

      // check video format
      for (let i = 0; i < allowedVideoTypes.length; i++) {
        if (video.mimetype === allowedVideoTypes[i]) {
          videoTypeIsAllowed = !videoTypeIsAllowed;
        }
      }

      // validate video format
      if (!videoTypeIsAllowed) {
        return res.json({
          status: 'failed',
          error: 'video format not supported'
        });
      }

      const duration = Number.parseInt(req.body.duration);
      const {
        access_token
      } = req.body;
      if (!access_token) {
        return res.status(400).json({
          status: false,
          error: 'missing access_token'
        });
      }

      // Check if duration is null, undefined or is not a number
      if (typeof duration !== 'number' || !duration) {
        return res.json({
          status: 'failed',
          message: 'duration must be a number'
        });
      }
      // Check the length of the duration
      if (duration > 59.999999) {
        return res.json({
          status: 'failed',
          message: 'max sound duration exceeded'
        });
      }

      // Log file upload finished
      busboy.on('finish', async () => {
        // console.log(req.files.music);
        const videoPath = `public/${video.name}`;
        fs.writeFile(videoPath, video.data, (err) => {
          if (err) {
            console.log('an error occured in creating the video: ', err);
            return;
          }
        });


        const audioResult = sound ? await uploadToS3(sound) : null;
        const videoResult = await uploadToS3(video);
        if ((audioResult && audioResult.Location) || videoResult.Location) { // Validate s3 upload

          // check if song exists in db
          const isSongInDb = sound ? await OriginalSound.findOne({
            url: audioResult.Location
          }) : null;
          if (isSongInDb) {
            return res.json({
              status: 'failed',
              error: 'Song exists'
            });
          }

          // Set music recognition api data
          const data = sound ? {
            'api_token': RECOGNITION_API_KEY,
            url: audioResult.Location,
            return: 'apple_music,spotify'
          } : null;

          const video_data = {
            video_id: uuidv4(),
            video_url: videoResult.Location,
            posted_by: user,
            posted_date: moment().format('dddd, MMMM Do YYYY, h:mm:ss a')
          };

          if (sound) {
            // Post music data to recognition api
            const recognized_music = await axios.post(RECOGNITION_BASE_URI, data);
            let soundData;
            try {
              // Set sound data
              if (recognized_music.data.status === 'success' && recognized_music.data.result.spotify) {
                // find song in 
                const {
                  uri
                } = recognized_music.data.result.spotify;
                const spotify_playlist_config = {
                  headers: {
                    Authorization: `Bearer ${access_token}`
                  }
                };
                // Get all playlists
                const spotify_playlists = await (await axios.get('https://api.spotify.com/v1/me/playlists', spotify_playlist_config)).data;
                let isSongInLibrary = false;
                let songInLibrary;
                // loop through the playlists and fetch the tracks
                for (let playlist of spotify_playlists.items) {
                  const id = playlist.id;
                  const currentPlaylistIndex = spotify_playlists.items.findIndex((x) => x.name === 'Dance');
                  const currentPlaylist = spotify_playlists.items[currentPlaylistIndex];
                  // fetch all tracks in the playlist and find the song
                  const playlist_tracks = await (await axios.get(`https://api.spotify.com/v1/playlists/${id}/tracks`, spotify_playlist_config)).data;
                  const songExistsInSpotifyLibrary = playlist_tracks.items.find((track) => track.track.uri === uri);
                  if (songExistsInSpotifyLibrary) {
                    isSongInLibrary = true;
                    songInLibrary = songExistsInSpotifyLibrary;
                    break;
                  }

                  console.log('song is in library: ', isSongInLibrary);

                  // upload song to playlist
                  if (!isSongInLibrary && currentPlaylist) {
                    // add song to a category
                    console.log('Current Playlist: ', currentPlaylist);
                    const playlist_update_config = {
                      headers: {
                        Authorization: `Bearer ${access_token}`,
                        'Content-Type': 'application/json'
                      }
                    };
                    const playlist_update_data = {
                      uris: [uri]
                    };
                    const playlistUpdate = await axios.post(`https://api.spotify.com/v1/playlists/${currentPlaylist.id}/tracks`, playlist_update_data, playlist_update_config);
                    console.log('playlist update: ', playlistUpdate.data);
                    createSoundAndVideoInDb(recognized_music.data.result.spotify, sound.data, video_data, res);
                    return;
                  }
                }

                if (isSongInLibrary) {
                  createSoundAndVideoInDb(songInLibrary, sound.data, video_data, res);
                  return;
                }
              }
            } catch (error) {
              console.log(error.response.data);
              return res.status(500).json({
                status: true,
                error: error.message
              });
            }
            return;
          }

          try { // sound was not added
            // extract sound from video
            console.log('in video try catch');
            const videoObject = await new Ffmpeg(videoPath); // create new video object with Ffmpeg
            const audioName = video.name.replace('.mp4', '_audio.mp3');
            const audioPath = `public/${audioName}`;
            const videoAudio = await videoObject.fnExtractSoundToMP3(audioPath);
            if (videoObject && videoAudio) {
              console.log('video audio extracted');
              // extract audio from video
              const buffer = fs.readFileSync(videoAudio);
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
                deleteFiles([videoPath, audioPath]);
                // save data to db
                const soundData = {
                  name: 'Original OriginalSound',
                  url: audioUpload.Location,
                  sound_id: uuidv4(),
                  sound_artist: user.username,
                  original_sound: true,
                  originated_by: {
                    user
                  },
                  created_date: moment().format('dddd, MMMM Do YYYY, h:mm:ss a')
                };

                // find song in db and library
                const recognizion_data = {
                  'api_token': RECOGNITION_API_KEY,
                  url: audioUpload.Location,
                  return: 'apple_music,spotify'
                };
                const recognized_music = await axios.post(RECOGNITION_BASE_URI, recognizion_data);
                console.log(recognized_music.data);

                if (recognized_music.data.status === 'error') {
                  return res.status(500).json({
                    status: false,
                    error: 'an error occured'
                  });
                }

                if (recognized_music.data.status && recognized_music.data.result !== null) {
                  fs.writeFile('public/original_audio.mp3', recognized_music.data.result.song_link, async (err) => {
                    if (err) {
                      console.log('could not create audio', err);
                      return;
                    }
                    console.log('video created');
                    const originalAudioBuffer = fs.readFileSync('public/original_audio.mp3');

                    const original_audio_data = {
                      name: `${recognized_music.data.result.title} - ${recognized_music.data.result.artist}.mp3`,
                      data: originalAudioBuffer
                    };

                    const originalAudioUpload = await uploadToS3(original_audio_data);
                    console.log('original audio upload', originalAudioUpload);

                    if (!originalAudioUpload.Location) {
                      console.log('audio upload failed');
                      return res.status(500).json({
                        status: false,
                        error: 'could not upload original audio to s3'
                      });
                    }


                    const songInDb = await OriginalSound.findOne({
                      url: originalAudioUpload.Location
                    });
                    if (songInDb) {
                      console.log('songInDb: ', songInDb);
                      video_data.sound = songInDb._id;
                      const new_video = await (await Video.create(video_data)).execPopulate('sound');
                      const responseData = {
                        message: 'New video uploaded',
                        video: new_video
                      };
                      return res.status(201).json({
                        status: true,
                        data: responseData
                      });
                    }

                    soundData.url = originalAudioUpload.Location;
                    const new_sound = await OriginalSound.create(soundData);
                    video_data.sound = new_sound._id;
                    const new_video = await (await Video.create(video_data)).execPopulate('sound');
                    const responseData = {
                      message: 'New video uploaded',
                      video: new_video
                    };

                    if (new_sound && new_video) {
                      console.log('new sound and video createdin db');
                      return res.status(201).json({
                        status: true,
                        data: responseData
                      });
                    }
                  });
                }
                // create original sound by user
                const songInDb = await OriginalSound.findOne({
                  url: audioUpload.Location
                });
                if (songInDb) {
                  console.log('songInDb: ', songInDb);
                  video_data.sound = songInDb._id;
                  const new_video = await (await Video.create(video_data)).execPopulate('sound');
                  const responseData = {
                    message: 'New video uploaded',
                    video: new_video
                  };
                  return res.status(201).json({
                    status: true,
                    data: responseData
                  });
                }

                soundData.url = audioUpload.Location;
                const new_sound = await OriginalSound.create(soundData);
                video_data.sound = new_sound._id;
                const new_video = await (await Video.create(video_data)).execPopulate('sound');
                const responseData = {
                  message: 'New video uploaded',
                  video: new_video
                };

                if (new_sound && new_video) {
                  console.log('new sound and video createdin db');
                  return res.status(201).json({
                    status: true,
                    data: responseData
                  });
                }
              }

            }
            console.log('outside video and audio extraction check');
            return res.status(500).json({
              status: false,
              error: 'no video object'
            });
          } catch (error) {
            console.log(error);
            console.log('Hello error');
            return res.status(500).json({
              status: false,
              error: error.message
            });
          }
        }
      });
      req.pipe(busboy);
    });

  router.route('/library')
    .get((req, res) => {
      return res.render('library');
    });

  // Get all music endpoint
  router.route('/all')
    .get(requiredLogin, async (req, res) => {
      const {
        access_token
      } = req.query;
      if (!access_token) {
        return res.status(400).json({
          status: false,
          message: 'missing access_token'
        });
      }
      const endpoint = 'https://api.spotify.com/v1/me/playlists';
      const config = {
        headers: {
          Authorization: `Bearer ${access_token}`
        }
      };
      try {
        const playlists = await (await axios.get(endpoint, config)).data;
        let categories = [];

        for (let playlist of playlists.items) {
          // Check if playlist exists in db
          const playlistExistInDb = await Playlist.findOne({ playlist_id: playlist.id });
           // create playlist data
           const playlist_data = {
            playlist_id: playlist.id,
            playlist_name: playlist.name,
            playlist_snapshot_id: playlist.snapshot_id,
            playlist_uri: playlist.uri,
            playlist_tracks: playlist.tracks
          };

          // create new playlist if it doesn't exist
          let new_playlist_in_db = playlistExistInDb ? playlistExistInDb : await Playlist.create(playlist_data);
          const tracksUrl = playlist.href;
          const category = playlist.name;
          const songs = [];
          const tracks = await (await axios.get(tracksUrl, config)).data;
          for (let i = 0; i < tracks.tracks.items.length; i++) {
            // find track in db
            const trackExistsInDb = await Track.findOne({ track_id: tracks.tracks.items[i].track.id });
            if(!trackExistsInDb) {
              // create db track data
              const track_data = {
                track_id: tracks.tracks.items[i].track.id,
                track_name: tracks.tracks.items[i].track.name,
                track_artists: tracks.tracks.items[i].track.artists,
                track_images: tracks.tracks.items[i].track.album.images,
                track_preview_url: tracks.tracks.items[i].track.preview_url || '',
                track_uri: tracks.tracks.items[i].track.uri,
                playlist_id: new_playlist_in_db._id
              };
              const new_track_in_db = await Track.create(track_data);
              console.log('New track created: ', new_track_in_db);
            }
            const artists = [];
            for (let artist of tracks.tracks.items[i].track.artists) {
              artists.push(artist.name);
            }
            if (tracks.tracks.items[i].track.preview_url) {
              songs.push({
                artists,
                id: tracks.tracks.items[i].track.id,
                name: tracks.tracks.items[i].track.name,
                url: tracks.tracks.items[i].track.preview_url
              });
            }
            continue;
          }
          categories.push({
            category,
            songs
          });
        }

        if (categories) {
          return res.status(200).json({
            status: true,
            categories
          });
        }
      } catch (error) {
        console.log(error);
        return res.status(500).json({
          status: false,
          error: 'an error occured'
        });
      }
    });

  // Extract audio from video endpoint
  /*  
    router.route('/extract')
      .post(async (req, res) => {
        const {
          video_url
        } = req.body;
        console.log(video_url);
  
        try {
          // create new video object with Ffmpeg
          const video = await new Ffmpeg(video_url);
          if (video) {
            // extract audio from video
            const extractedAudio = await video.fnExtractSoundToMP3('public/audio.mp3');
            return res.json({
              status: true,
              video_metadata: video.metadata,
              audioPath: extractedAudio
            });
          }
        } catch (error) {
          console.log(error);
          return res.json({
            status: false,
            error: error
          });
        }
      });
  */
  return router;
};


module.exports = routes;