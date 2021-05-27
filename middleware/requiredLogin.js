// jshint esversion:9
const jwt = require('jsonwebtoken');
const { Admin } = require('../models/admin.model');

const middleware = async (req, res, next) => {
  const { authorization } = req.headers;
  console.log(authorization);
  if(!authorization) {
    return res.status(401).json({
      status: false,
      error: 'unauthorized'
    });
  }

  const token = authorization ? authorization.trim().replace('Bearer ', ''): null;
  console.log(token);
  try {
    const payload = jwt.verify(token ? token.trim() : null, process.env.ADMIN_JWT_ACCESS_SECRET);
    console.log('payload: ', payload);
    // @ts-ignore
    const { _id } = payload;
    if(!_id) {
      const error = new jwt.JsonWebTokenError('invalid token', new Error('token error'));
      console.log(error);
      return res.status(401).json({
        status: false,
        error
      });
    }
    const admin = await Admin.findById(_id);
    if(admin) {
      req.admin = admin;
      return next();
    }
    return res.status(401).json({
      status: false,
      error: 'unauthorized'
    });
  } catch (error) {
    console.log(error.message);
    if(error.message === 'jwt expired') {
      return res.status(401).json({
        status: false,
        error: 'access token expired'
      });
    }
    return res.status(500).json({
      status: false,
      error: 'an error occured'
    });
  }
};

module.exports = middleware;