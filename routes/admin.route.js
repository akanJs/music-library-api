// jshint esversion:9
const router = require('express').Router();
const jwt = require('jsonwebtoken');
const {
  Admin
} = require('../models/admin.model');
const {
  RefreshToken
} = require('../models/refreshToken.model');
const bcrypt = require('bcrypt');
const queryString = require('querystring');


const spotify_id = process.env.SPOTIFY_ID;
const authEndpoint = 'https://accounts.spotify.com/authorize';

const generateRandomString = function (length) {
  let text = '';
  let possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

const stateKey = 'spotify_auth_state';
const scope = 'user-read-private user-read-email user-library-read playlist-read-private playlist-read-collaborative playlist-modify-public playlist-modify-private';
const state = generateRandomString(16);

const options = queryString.stringify({
  response_type: 'code',
  client_id: spotify_id,
  scope: scope,
  redirect_uri: process.env.SPOTIFY_REDIRECT_URI,
  state: state
});


const generateRefreshToken = (id) => {
  const refresh_token = jwt.sign({
    _id: id
  }, process.env.ADMIN_JWT_REFRESH_SECRET);
  return refresh_token;
};

const routes = () => {

  router.route('/')
    // @ts-ignore
    .get((req, res) => {
      res.cookie('spotify_auth_state', 'pcdsoaogvXDoxdFz');
      return res.cookie(stateKey, state).redirect(`${authEndpoint}?${options}`);
    });

  // create admin route
  router.route('/create')
    .post(async (req, res) => {
      const {
        name,
        email,
        password
      } = req.body;

      // validate if all fields were sent
      if (!name || !email || !password) {
        return res.status(400).json({
          status: false,
          error: 'missing details'
        });
      }

      // validate the length of the strings
      if (email.length > 200 || password.length > 15 || name.length > 100) {
        return res.status(422).json({
          status: true,
          error: 'fields length exceeds the maximum'
        });
      }

      // create new admin
      const hashedPassword = await bcrypt.hash(password, 10);
      const admin_data = {
        name,
        email,
        password: hashedPassword
      };
      try {
        const admin = await Admin.create(admin_data);
        const admin_refresh_token = generateRefreshToken(admin._id); // generate refresh token for new admin
        if (admin) {
          const refresh_token = await RefreshToken.create({
            admin_id: admin._id,
            refresh_token: admin_refresh_token
          });
          // @ts-ignore
          console.log('New refresh Token', refresh_token.refresh_token);
          return res.status(201).json({
            status: true,
            message: 'admin created successfully'
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

  router.route('/login')
    .get((req, res) => {
      return res.render('admin-login');
    })
    .post(async (req, res) => {
      const {
        email,
        password
      } = req.body;
      // verify username and password was sent
      if (!email || !password) {
        return res.status(400).json({
          status: false,
          error: 'missing username or password'
        });
      }
      // find admin in db
      const admin = await Admin.findOne({
        email
      });
      if (admin) {
        // compare passwords
        // @ts-ignore
        if (await bcrypt.compare(password, admin.password)) {
          try {
            // sign admin id in jwt token
            const access_token = jwt.sign({
              _id: admin._id
            }, process.env.ADMIN_JWT_ACCESS_SECRET, {
              expiresIn: '30m'
            });
            // Get admin refresh token from db
            const refresh_token = await RefreshToken.findOne({
              admin_id: admin._id
            });
            return res.status(200).json({
              status: true,
              access_token,
              // @ts-ignore
              refresh_token: refresh_token.refresh_token
            });
          } catch (error) {
            console.log(error);
            return res.status(500).json({
              status: false,
              error: 'an error occured'
            });
          }
        }
        return res.status(422).json({
          status: false,
          error: 'incorrect email or password'
        });
      }
      return res.status(422).json({
        status: false,
        error: 'incorrect email or password'
      });
    });

  return router;
};

module.exports = routes;