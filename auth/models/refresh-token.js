const mongoose = require('mongoose');

const RefreshTokenSchema = new mongoose.Schema({
    token: {
        type: String,
        required: true
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, {
    timestamps: true
});

const RefreshToken = mongoose.model('RefreshToken', RefreshTokenSchema);

module.exports = RefreshToken;