const express = require('express');
const { isAuthenticated } = require('../config/auth');
const moment = require('moment');
const router = express.Router();

const { systemError } = require('../functions/errors');

const Profile = require('../models/profile');

router.post('/', isAuthenticated, async (req, res, next) => {
    try {
        let { gender, phoneNumber, address, dateOfBirth, country } = req.body;
        if (dateOfBirth) {
            dateOfBirth = moment(dateOfBirth, 'DD-MM-YYYY');
        }
        const profile = new Profile({ gender, phoneNumber, address, dateOfBirth, country, user: req.user.id });
        await profile.save();
        res.json(profile);
    } catch (e) {
        if (e.code = 11000) {
            next(systemError('Profile already exists.'));
        } else {
            throw e;
        }
    }
});

router.get('/', isAuthenticated, async (req, res, next) => {
    try {
        const profile = await Profile.findOne({ user: req.user.id }).populate('user');
        res.json(profile);
    } catch (e) {
        next(systemError(e.message));
    }
});

router.put('/', isAuthenticated, async (req, res, next) => {
    try {
        let { gender, phoneNumber, address, dateOfBirth, country } = req.body;

        if (dateOfBirth) {
            dateOfBirth = moment(dateOfBirth, 'DD-MM-YYYY');
        }

        const update = await Profile.updateOne({ user: req.user.id }, { 
            $set: { gender, phoneNumber, address, dateOfBirth, country, user: req.user.id } 
        });

        if (update.nModified) {
            const profile = await Profile.findOne({ user: req.user.id });
            res.json(profile);
        } else {
            next(systemError('An error occurred.'));
        }
    } catch (e) {
        next(systemError(e.message));
    }
});

module.exports = router;