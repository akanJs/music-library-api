// Declarations
const express = require('express');
const musicApi = require('./routes/music.route');
const busboy = require('connect-busboy');
const busboyBodyParser = require('busboy-body-parser');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;


// mongoose config
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/AfroMusicLibrary', {
    useUnifiedTopology: true,
    useNewUrlParser: true
  }).then((client) => {
    if (client) {
      console.log('DB connected sucessfully');
    }
  }).catch((err) => {
    console.log(err);
  });

// App configuration
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static('public'));
app.use(busboy());
app.use(busboyBodyParser());

app.set('view engine', 'ejs');

app.use('/music', musicApi());


app.get('/', (req, res) => {
  res.render('upload');
});

// App listening port
app.listen(PORT, () => {
  console.log(`App started on port ${PORT}`);
});