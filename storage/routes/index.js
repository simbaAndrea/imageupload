const express = require('express');
const router = express.Router();

router.use('/image', require('./images'));
router.use('/files', require('./files'));

module.exports = router;