// jshint esversion:9
const musicListDiv = document.getElementById('music-list');
const baseUri = 'https://afromusic.s3.us-east-2.amazonaws.com/';

document.cookie = 'spotify_auth_state=pcdsoaogvXDoxdFz';

const musicForm = document.getElementById('musicForm');

/**
 * @param {string} refresh_token
 */
async function getNewAccessToken(refresh_token) {
  const data = {
    refresh_token
  };
  const tokenResponse = await axios.post('/auth/refresh_token', data);
  return tokenResponse.data;
}

async function getAccessToken() {
  const access_token_location = document.cookie.search('access_token');
  const refresh_token_location = document.cookie.search('refresh_token');

  console.log(refresh_token_location);

  if (access_token_location === -1) {
    console.log('access token expired');

    if (refresh_token_location === -1) {
      alert('Unauthorized');
      return window.location.href = '/';
    }
    const refresh_slice = document.cookie.slice(refresh_token_location, document.cookie.length);
    const refresh_split = refresh_slice.split(';');
    const refresh_token = refresh_split[0].replace('refresh_token=', '');
    const response = await getNewAccessToken(refresh_token.trim());
    return response.access_token;
  }

  const sliceString = document.cookie.slice(access_token_location, document.cookie.length);
  const tokenSplit = sliceString.split(';');
  const access_token = tokenSplit[0].replace('access_token=', '');
  return access_token;
}

const checkAuthState = () => {
  console.log('In auth state');
  const user_access_token = localStorage.getItem('access_token');
  if (!user_access_token) {
    alert('session expired');
    return false;
  }
  return true;
};

/**
 * @param {string} base64
 */
function _base64ToArrayBuffer(base64) {
  var binary_string = window.atob(base64);
  var len = binary_string.length;
  var bytes = new Uint8Array(len);
  for (var i = 0; i < len; i++) {
    bytes[j] = binary_string.charCodeAt(i);
  }
  return bytes.buffer;
}


if (window.location.pathname === '/admin/login' || window.location.pathname === '/admin/login/') {
  const loginForm = $('#loginForm');
  loginForm.on('submit', async (e) => {
    e.preventDefault();
    const email = $('#email');
    const password = $('#password');
    // attempt login
    try {
      const response = await axios.post('/admin/login', {
        email: email.val().trim(),
        password: password.val().trim()
      });
      console.log(response);
      if (response.data.status) {
        localStorage.setItem('access_token', response.data.access_token);
        localStorage.setItem('refresh_token', response.data.refresh_token);
        window.location.href = '/music/library';
        return;
      }
      alert(response.data.error);
    } catch (error) {
      console.log(error.message);
      if (error.response) {
        console.log(error.response.data);
        alert(error.response.data.error);
        return;
      }
      alert('an error occured');
    }
  });
}

if (window.location.pathname === '/music/upload' || window.location.pathname === '/music/upload/') {
  if (!checkAuthState()) {
    window.location.href = '/admin/login';
  }

  const video = document.getElementById('video');
  const sound = document.getElementById('sound');

  // Submit form
  musicForm.onsubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData();
    const access_token = await getAccessToken();
    formData.append('video', video.files[0]);
    formData.append('sound', sound.files[0]);
    formData.append('duration', 14);
    formData.append('access_token', access_token);


    axios.post('/music/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    }).then(async ( /** @type {{ data: { base64String: any; }; }} */ response) => {
      console.log(response.data);
      const buffer = _base64ToArrayBuffer(response.data.base64String);
      console.log(buffer);
      const baseAudioContext = new BaseAudioContext();
      const audio = await baseAudioContext.decodeAudioData(buffer);
      console.log(audio);
      // source.src = response.data.music.url;
      // audio.load();
      // audio.ondurationchange = () => {
      //   console.log(audio.duration);
      // };
    }).catch(( /** @type {{ message: any; }} */ err) => {
      console.log(err.message);
    });
  };
}

if (window.location.pathname === '/music/library' || window.location.pathname === '/music/library/') {
  checkAuthState() ? (async function () {
    const access_token = await getAccessToken();
    const token = localStorage.getItem('access_token');
    console.log(token);
    const config = {
      params: {
        access_token
      },
      headers: {
        Authorization: 'Bearer ' + token
      }
    };
    axios.get('/music/all', config)
      .then((
        /** @type {{ data: { status: boolean; categories: any; error: string | string[]; }; }} */
        response
      ) => {

        console.log(response.data);
        if (response.data.status) {

          for (let category of response.data.categories) {
            // create category header
            const h2 = document.createElement('h2');

            h2.innerText = category.category;
            musicListDiv.appendChild(h2);

            // iterate through songs in category
            for (let song of category.songs) {
              // Get song name
              const musicName = song.original_sound ?
                `${song.name} - ${song.originated_by.user.username}` :
                `${song.name} - ${song.artists.join(', ')}`;
              const musicStreamUri = song.url; // get song url
              // create song title element and and audio element
              const p = document.createElement('p');
              const audio = document.createElement('audio');
              const source = document.createElement('source');

              // Audio and source config
              audio.controls = true;
              audio.controlsList = 'nodownload';
              audio.loop = false;
              audio.id = `id-${song.id}`;
              source.src = musicStreamUri;
              source.type = 'audio/mpeg';

              // song title config
              p.innerText = `${musicName}`;
              p.style.display = 'block';

              // append audio and source to DOM
              audio.appendChild(source);
              musicListDiv.appendChild(p);
              musicListDiv.appendChild(audio);
            }
          }

          // Get all audio element from DOM
          const audios = $('audio');
          // Loop through audios
          for (let i = 0; i < audios.length; i++) {
            // Listen for onplay event
            audios[i].onplay = () => {
              // filter audio that's not playing
              const notPlaying = audios.filter(( /** @type {number} */ x) => x !== i);
              // loop through not playing audios and pause
              for (let item of notPlaying) {
                item.pause();
                item.currentTime = 0;
              }
            };
          }
        }

        if (response.data.status === 'failed' && response.data.error.includes('Inaccessible host')) {
          alert('Please check your internet connection');
        }
      }).catch(( /** @type {any} */ err) => {
        if (err.response) {
          if (err.response.data.error === 'access token expired') {
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            window.location.href = '/admin/login';
          }
          console.log(err.response.data);
          return;
        }
        console.log(err);
      });

    const searchForm = document.getElementById('searchForm');
    const key = document.getElementById('search_key');

    searchForm.onsubmit = async (e) => {
      e.preventDefault();

      const config = {
        params: {
          access_token,
          key: key.value
        },
        headers: {
          Authorization: `Bearer ${token}`
        }
      };
      const response = await (await axios.get('/music/search', config)).data;
      const { items } = response.data.tracks;
      const exactTracks = items.filter((item) => item.name.toLowerCase().includes(key.value.toLowerCase()));
      console.log(exactTracks);
    };
  }()) : window.location.href = '/admin/login';
}


if (window.location.pathname === '/client/music/library' || window.location.pathname === '/client/music/library/') {
  (async function () {
    // const access_token = await getAccessToken();
    // const config = {
    //   params: {
    //     access_token
    //   }
    // };
    axios.get('/client/get-all-sounds')
      .then(( /** @type {{ data: { status: string; categories: any; error: string | string[]; }; }} */ response) => {
        console.log(response);
        if (response.data.status) {

          for (let category of response.data.categories) {
            // create category header
            const h2 = document.createElement('h2');

            h2.innerText = category.category;
            musicListDiv.appendChild(h2);
            const songs = category.songs.filter(( /** @type {{ track_preview_url: string; }} */ song) => song.track_preview_url !== '');

            // iterate through songs in category
            for (let song of songs) {
              // Get song name
              const artists = [];
              for (let artist of song.track_artists) {
                artists.push(artist.name);
              }
              const musicName = song.original_sound ?
                `${song.track_name} - ${song.originated_by.user.username}` :
                `${song.track_name} - ${artists.join(', ')}`;
              const musicStreamUri = song.track_preview_url; // get song url
              // create song title element and and audio element
              const p = document.createElement('p');
              const a = document.createElement('a');
              const audio = document.createElement('audio');
              const source = document.createElement('source');

              // Audio and source config
              audio.controls = true;
              audio.controlsList = 'nodownload';
              audio.loop = false;
              audio.id = `id-${song.id}`;
              source.src = musicStreamUri;
              source.type = 'audio/mpeg';

              // song title config
              p.innerText = `${musicName}`;
              p.style.display = 'block';
              // song link
              a.href = `/client/upload-video?id=${song.track_id}`;
              a.innerText = '(use sound)';

              // append audio and source to DOM
              audio.appendChild(source);
              p.appendChild(a);
              musicListDiv.appendChild(p);
              musicListDiv.appendChild(audio);
            }
          }

          // Get all audio element from DOM
          const audios = $('audio');
          // Loop through audios
          for (let i = 0; i < audios.length; i++) {
            // Listen for onplay event
            audios[i].onplay = () => {
              // filter audio that's not playing
              const notPlaying = audios.filter(( /** @type {number} */ x) => x !== i);
              // loop through not playing audios and pause
              for (let item of notPlaying) {
                item.pause();
                item.currentTime = 0;
              }
            };
          }
        }

        if (response.data.status === 'failed' && response.data.error.includes('Inaccessible host')) {
          alert('Please check your internet connection');
        }
      }).catch(( /** @type {any} */ err) => {
        console.log(err);
      });

    const searchForm = document.getElementById('searchForm');
    const key = document.getElementById('search_key');

    searchForm.onsubmit = async (e) => {
      e.preventDefault();

      const config = {
        params: {
          access_token,
          key: key.value
        }
      };
      const response = await (await axios.get('/music/search', config)).data;
      console.log(response);
    }
  }());
}

if (window.location.pathname.includes('/client/upload-video')) {
  (async function () {
    const id = window.location.href.split('=')[1];
    try {
      const response = await (await axios.get(`/client/get-song/${id}`)).data;
      console.log(response);
      const audioSource = document.getElementById('uploadedMusicAudio');
      audioSource.src = response.url;
    } catch (error) {
      if (error.response) {
        console.log(error.response.data);
        alert('An error occured');
        return;
      }
      console.log(error.message);
    }
  }());

  const video = document.getElementById('video');
  const songInput = document.getElementById('sound');

  // sound input change
  const blob = window.URL || window.webkitURL;
  if (!blob) {
    alert('Your browser does not support Blob URLs :(');
  }

  let songUrl = '';
  songInput.onchange = (e) => {
    const file = songInput.files[0];
    const fileUrl = blob.createObjectURL(file);
    console.log(fileUrl);
    songUrl = fileUrl;
    const audioEl = document.getElementById('uploadedMusicAudio');
    audioEl.src = fileUrl;
  };

  // Submit form
  musicForm.onsubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData();
    // const access_token = await getAccessToken();
    formData.append('video', video.files[0]);
    formData.append('sound', songInput.files[0]);
    formData.append('songUrl', songUrl);
    formData.append('duration', 14);
    // formData.append('access_token', access_token);


    axios.post('/client/upload-video', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    }).then(async ( /** @type {{ data: { message: string; }; }} */ response) => {
      console.log(response.data);
      alert(response.data.message);
    }).catch(( /** @type {{ message: any; response?: {data: any} }} */ err) => {
      if(err.response) {
        console.log(err.response.data);
      }
      console.log(err.message);
    });
  };
}