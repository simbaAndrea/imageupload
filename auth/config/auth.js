const jwt = require('jsonwebtoken');
const { getToken } = require('../functions/users');
const { systemError } = require('../functions/errors');

const AdminUser = require('../models/admin');

module.exports = {
    isAuthenticated: async (req, res, next) => {
        try {
            const token = getToken(req);
            if (token) {
                const authData = jwt.verify(token, process.env.JWT_KEY);
                req.user = authData;
                next();
            } else {
                next(systemError('Access token needed to access this route.', 403));
            }
        } catch (e) {
            next(systemError(e.message, 401));
        }
    },
    isAdmin: async (req, res, next) => {
        try {
            const user = req.user;
            const admin = await AdminUser.findOne({ user: user.id });
            if (admin != null) {
                next();
            } else {
                const numberOfAdmins = await AdminUser.countDocuments({});
                if (numberOfAdmins == 0) {
                    const newAdmin = new AdminUser({ user: user.id });
                    await newAdmin.save();
                    next();
                } else {
                    next(systemError('This is an admin area only.', 401));
                }
            }
        } catch (e) {
            next(systemError(e.message, 403));
        }
    }
}