const express = require('express');
const router = express.Router();

router.use('/', require('./users'));
router.use('/profile', require('./profile'));
router.use('/admins', require('./admins'));

module.exports = router;