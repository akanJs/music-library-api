// Declarations
// jshint esversion:9
const express = require('express');
const musicApi = require('./routes/music.route');
const authApi = require('./routes/auth.route');
const clientApi = require('./routes/client.route');
const adminApi = require('./routes/admin.route');
const busboy = require('connect-busboy');
const busboyBodyParser = require('busboy-body-parser');
const mongoose = require('mongoose');
const queryString = require('querystring');
const cors = require('cors');

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
app.use(cors({
  allowedHeaders: ['GET', 'POST']
}));
app.use(busboy());
app.use(busboyBodyParser());

app.set('view engine', 'ejs');
app.use((req, res, next) => {
  res.setHeader('x-powered-by', 'Apache');
  next();
});

app.use('/music', musicApi());
app.use('/auth', authApi());
app.use('/client', clientApi());
app.use('/admin', adminApi());

app.get('/', (req, res) => {
  return res.redirect('/client/music/library');
});

app.get('/admin', (req, res) => {
  
});

// App listening port
app.listen(PORT, () => {
  console.log(`App started on port ${PORT}`);
});