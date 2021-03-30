const musicListDiv = document.getElementById('music-list');
const baseUri = 'https://afromusic.s3.us-east-2.amazonaws.com/';

const musicForm = document.getElementById('musicForm');
const music = document.getElementById('music');

const audioVerify = document.getElementById('outPutAudio');
const audio = document.getElementById('uploadedMusicAudio');
const source = document.getElementById('uploadedMusicSource');

music.onchange = () => {
  source.src = music.value;
  console.log(music.files);
};


// Submit form
musicForm.onsubmit = (e) => {
  e.preventDefault();
  const formData = new FormData();
  formData.append('music', music.files[0]);
  formData.append('duration', 14);

  axios.post('/music/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  }).then((response) => {
    console.log(response.data);
    source.src = response.data.music.url;
    audio.load();
    audio.ondurationchange = () => {
      console.log(audio.duration);
    };
  }).catch((err) => {
    console.log(err.message);
  });
};

axios.get('/music/all')
  .then((response) => {
    console.log(response.data);
    if (response.data.status === 'success') {
      response.data.sounds.forEach((music) => {
        const musicName = music.original_sound ? music.name + ' - ' + music.originated_by.user.username : music.name;
        const musicStreamUri = music.url;

        // Dynamic html elements
        const a = document.createElement('a');
        const audio = document.createElement('audio');
        const source = document.createElement('source');

        // Audio config
        audio.controls = true;
        audio.controlsList = 'nodownload';
        audio.loop = true;
        source.src = musicStreamUri;
        source.type = 'audio/mpeg';

        a.href = '/music/original-sound/' + music.sound_id;
        a.innerText = `${musicName}`;
        a.style.display = 'block';
        audio.appendChild(source);
        musicListDiv.appendChild(a);
        musicListDiv.appendChild(audio);
      });

      const audios = $('audio');
      for(let i = 0; i < audios.length;  i++) {
        audios[i].onplay = (e) => {
          const notPlaying = audios.filter((x) => x !== i );
          for(let item of notPlaying) {
            item.pause();
            item.currentTime = 0;
          }
          console.log(notPlaying);
        };
      }
    }

    if (response.data.status === 'failed' && response.data.error.includes('Inaccessible host')) {
      alert('Please check your internet connection');
    }
  }).catch((err) => {
    console.log(err);
  });
