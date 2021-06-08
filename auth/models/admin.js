const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const AdminUserSchema = new mongoose.Schema({
    user: { 
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: true
});

AdminUserSchema.plugin(mongoosePaginate);
const AdminUser = mongoose.model('AdminUser', AdminUserSchema);

module.exports = AdminUser;