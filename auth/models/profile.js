const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const ProfileSchema = new mongoose.Schema({
    gender: String,
    phoneNumber: String,
    address: String,
    dateOfBirth: {
        type: Date,
        default: undefined
    },
    country: String,
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, unique: true }
}, {
    timestamps: true
});

ProfileSchema.plugin(mongoosePaginate);
const Profile = mongoose.model('Profile', ProfileSchema);

module.exports = Profile;