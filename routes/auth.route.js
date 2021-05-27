// jshint esversion:9
const { Router } = require('express');
const axios = require('axios').default;
const queryString = require('querystring');

const base64String = Buffer.from(process.env.SPOTIFY_ID + ':' + process.env.SPOTIFY_SECRET).toString('base64');

const router = Router();

const routes = () => {

  router.route('/callback')
    .get(async (req, res) => {
      const tokenEndpoint = process.env.SPOTIFY_TOKEN_ENDPOINT;

      const data = queryString.stringify({
        grant_type: 'authorization_code',
        // @ts-ignore
        code: req.query.code,
        redirect_uri: process.env.SPOTIFY_REDIRECT_URI,
      });

      const base64String = Buffer.from(process.env.SPOTIFY_ID + ':' + process.env.SPOTIFY_SECRET).toString('base64');

      const config = {
        headers: {
          Authorization: `Basic ${base64String}`,
          'Content-Type':'application/x-www-form-urlencoded'
        }
      };


      try {
        const spotifyResponse = await axios.post(tokenEndpoint, data, config);
        console.log(spotifyResponse.data);
        const milliseconds = spotifyResponse.data.expires_in * 1000;
        console.log('milliseconds: ',milliseconds);
        const time = new Date().getTime() + milliseconds;
        const date = new Date(time);
        res.cookie('access_token', spotifyResponse.data.access_token, {
          expires: date
        });
        res.cookie('refresh_token', spotifyResponse.data.refresh_token);
        res.redirect('/music/library');
      } catch (error) {
        console.log('an error occured: ', error);
        return res.json({
          status: false,
          message: 'an error occured',
          error: error.message
        });
      }
    });

  router.route('/refresh_token')
    .post(async (req, res) => {
      const { refresh_token } = req.body;
      console.log(refresh_token);
      if(!refresh_token) {
        return res.status(400).json({
          status: false,
          error: 'missing refresh token'
        });
      }

      const endpoint = process.env.SPOTIFY_TOKEN_ENDPOINT;
      const data = queryString.stringify({
        grant_type: 'refresh_token',
        refresh_token
      });
      const config = {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${base64String}`
        }
      };
      try {
        const axiosResponse = await axios.post(endpoint, data, config);
        console.log(axiosResponse.data);
        const milliseconds = axiosResponse.data.expires_in * 1000;
        const time = new Date().getTime() + milliseconds;
        const date = new Date(time);
        return res.cookie('access_token', axiosResponse.data.access_token, {
          expires: date
        }).status(200).json({
          status: true,
          access_token: axiosResponse.data.access_token
        });
      } catch (err) {
        console.log(err);
        return res.status(500).json({
          status: false,
          error: err.message
        });
      }
    });

  return router;
};

module.exports = routes;
