const express = require('express');
const { formError, systemError } = require('../functions/errors');
const { isAuthenticated } = require('../config/auth');
const { userRegistrationValidationForm, hashPassword, loginFormValidation, getToken, sendEmailVerificationLink } = require('../functions/users');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const sgMail = require('@sendgrid/mail');

const User = require('../models/user');
const RefreshToken = require('../models/refresh-token');
const AdminUser = require('../models/admin');

//Handles user registration
router.post('/', async (req, res, next) => {
    let { firstName, lastName, email, password } = req.body;
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    try {
        const errors = userRegistrationValidationForm(req.body);
        if (errors.length == 0) {
            password = hashPassword(password);
            const newUser = new User({ firstName, lastName, email, password });
            await newUser.save();
            const token = jwt.sign({
                id: newUser._id,
                exp: Math.floor(Date.now() / 1000) + (60 * 60)
            }, process.env.EMAIL_VERIFICATION_KEY);
            const url = `${process.env.BASE_URL}/verify?token=${token}`;
            res.json({ ...newUser._doc, url });
        } else {
            next(formError(errors));
        }
    } catch (e) {
        if (e.code = 11000) {
            next(systemError('User already exists.'));
        } else {
            console(e.message);
        }
    }
});

router.get('/', async (req, res, next) => {
    try {
        const page = req.query.page != undefined ? +req.query.page : 1;
        const limit = req.query.limit != undefined ? +req.query.limit : 20;
        const query = req.query.query != undefined ? req.query.query : '';
        const sortBy = req.query.sort != undefined ? req.query.sort : 'createdAt';
        const order = req.query.order != undefined ? req.query.order : -1;
        
        const re = new RegExp(query, "gi");

        const users = await User.paginate(
            {email: re},
            {
                limit,
                page,
                select: '-password',
                sort: { [sortBy]: order },
            }
        );
        res.json(users);
    } catch (e) {
        next(systemError(e.message));
    }
});

router.post('/request-verification-token', async (req, res, next) => {
    try {
        const user = await User.findOne({ email: req.body.email });
        const emailSent = await sendEmailVerificationLink(user);
        if (emailSent) {
            res.json(user);
        } else {
            next(systemError('User already verified.', 406));
        }
    } catch (e) {
        next(systemError(e.message));
    }
});

router.get('/request-verification-token/:id', async (req, res, next) => {
    try {
        const user = await User.findOne({ _id: req.params.id });
        const emailSent = await sendEmailVerificationLink(user);
        if (emailSent) {
            res.json(user);
        } else {
            next(systemError('User already verified.', 406));
        }
    } catch (e) {
        console.log(e.message);
        next(systemError(e.message));
    }
});

router.get('/verify', async (req, res, next) => {
    try {
        const token = req.query.token;
        const userData = jwt.verify(token, process.env.EMAIL_VERIFICATION_KEY);
        const user = await User.findOne({ _id: userData.id });
        if (user) {
            if (user.isVerified) {
                next(systemError('User already verified.', 406));
            } else {
                const updated = await User.updateOne({ _id: userData.id }, { $set: { isVerified: true } });
                if (updated.nModified) {
                    res.sendStatus(200);
                } else {
                    next(systemError('An error occurred.'));
                }
            }
        } else {
            next(systemError('User not found', 406));
        }
    } catch (e) {
        if (e instanceof jwt.TokenExpiredError) {
            next(systemError(e.message, 406));
        } else {
            next(systemError(e.message));
        }
    }
});
router.post('/login', async (req, res, next) => {
    try {
        const { email, password } = req.body;
        const errors = loginFormValidation(req.body);
        const errorMsg = systemError('Email or password is incorrect.');
        if (errors.length == 0) {
            const isUserAvailable = await User.findOne({ email });
            if (isUserAvailable) {
                const user = isUserAvailable._doc;
                if (!user) {
                    next(errorMsg);
                } else {
                    let isCorrect = bcrypt.compareSync(password, user.password);
                    if (isCorrect) {

                        const refreshToken = jwt.sign({
                            id: user._id,
                            lastLogin: Date.now
                        }, process.env.REFRESH_TOKEN_KEY);

                        const refreshTokenDb = new RefreshToken({ token: refreshToken, createdBy: user._id });
                        await refreshTokenDb.save();

                        delete user.password;
                        res.json({ ...user, refreshToken });
                    } else {
                        next(errorMsg);
                    }
                }
            } else {
                next(systemError('User not found', 404));
            }
        } else {
            next(formError(errors));
        }
    } catch (e) {
        console.log(e.message);
        next(systemError(e.message));
    }
});

router.post('/refresh-token', async (req, res, next) => {
    try {
        const token = getToken(req);
        const tokenAvailable = await RefreshToken.findOne({ token });

        if (tokenAvailable) {
            const data = jwt.verify(token, process.env.REFRESH_TOKEN_KEY);

            const user = (await User.findOne({ _id: data.id }))._doc;
            if (!user) {
                next(systemError('User not available in the system.'));
            } else {
                const admin = await AdminUser.findOne({ user: user._id });
                let isAdmin = admin != null;

                const token = jwt.sign({
                    id: user._id,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    displayImage: user.displayImage,
                    isVerified: user.isVerified,
                    isAdmin,
                    exp: Math.floor(Date.now() / 1000) + (60 * 60 * 10)
                }, process.env.JWT_KEY);
                
                res.json({ token });
            }
        } else {
            next(systemError('Invalid token.', 403));
        }
        
    } catch (e) {
        console.log(e.message);
        next(systemError(e.message));
    }
});

router.delete('/logout', isAuthenticated, async (req, res, next) => {
    try {
        await RefreshToken.deleteOne({ createdBy: req.user.id });
        res.sendStatus(200);
        
    } catch (e) {
        next(systemError(e.message));
    }
});

router.get('/current', isAuthenticated, async (req, res) => {
    try {
        const user = await User.findOne({ _id: req.user.id }).select('-password');
        const admin = await AdminUser.findOne({ user: user._id });
        let isAdmin = admin != null;
        res.json({ ...user._doc, isAdmin });
    } catch (e) {
        next(systemError(e.message));
    }
});

router.get('/user/:id', async (req, res, next) => {
    try {
        const user = await User.findOne({ _id: req.params.id }).select('-password');
        res.json(user);
    } catch (e) {
        next(systemError(e.message));
    }
});

router.put('/update', isAuthenticated, async (req, res, next) => {
    try {
        const body = req.body;
        const { firstName, lastName } = body;
        delete body.password;
        if (!firstName) {
            delete body.firstName;
        }
        if(!lastName) {
            delete body.lastName;
        }
        const update = await User.updateOne({ _id: req.user.id }, { $set: body });
        const user = await User.findOne({ _id: req.user.id }).select('-password');
        if (update.nModified) {
            res.status(201);
            res.json(user);
        } else {
            next(systemError('An error occurred.'));
        }
    } catch (e) {
        next(systemError(e.message));
    }
});

module.exports = router;
