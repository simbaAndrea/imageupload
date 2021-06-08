const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sgMail = require('@sendgrid/mail');

const userRegistrationValidationForm = (body) => {
    const errors = [];
    const { firstName, lastName, email, password, passwordConfirmation } = body;

    //Validating first name
    if (!firstName) {
        errors.push({ field: 'firstName', message: 'First name is required.' });
    }

    //Validating last name
    if (!lastName) {
        errors.push({ field: 'lastName', message: 'Last name is required.' });
    }

    //Validating email address
    if (!email) {
        errors.push({ field: 'email', message: 'Email is required.' });
    } else {
        if (!(/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(email))){
            errors.push({ field: 'email', message: 'Email provided is invalid.' });
        }
    }

    //Validating password
    if (!password) {
        errors.push({ field: 'password', message: 'Password is required.' });
    } else {
        if (password.length < 6) {
            errors.push({ field: 'password', message: 'Password must be 6 or more characters.' });
        }
    }

    //Validating password confirmation
    if (!passwordConfirmation) {
        errors.push({ field: 'passwordConfirmation', message: 'Password confirmation is required.' });
    } else {
        if (password != passwordConfirmation) {
            errors.push({ field: 'password', message: 'Passwords do not match.' });
        }
    }

    return errors;
}

const loginFormValidation = (body) => {
    const { email, password } = body;
    const errors = [];

    //Validating email
    if (!email) {
        errors.push({ field: 'email', message: 'Email is required.' });
    }

    //Validating password
    if (!password) {
        errors.push({ field: 'password', message: 'Password is required.' });
    }
    return errors;
}

const hashPassword = (password) => {
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(password, salt);
    return hash;
}

const getToken = (req) => {
    const bearerHeader = req.headers['authorization'] || '';
    if (typeof bearerHeader == undefined) {
        return null;
    } else if (bearerHeader.indexOf(' ') > -1) {
        return bearerHeader.split(' ')[1];
    } else {
        return bearerHeader;
    }
} 

const sendEmailVerificationLink = async (user) => {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    if (user.isVerified) {
        return false;
    } else {
        const token = jwt.sign({
            id: user._id,
            exp: Math.floor(Date.now() / 1000) + (60 * 60 * 5)
        }, process.env.EMAIL_VERIFICATION_KEY);

        const url = `${process.env.FRONT_END_URL}/verify?token=${token}`;
        console.log(url);
        
        const msg = {
            to: user.email,
            from: 'isesuzw@gmail.com',
            subject: 'Verify your ISESU account.',
            text: 'We are checking if you own this email address.',
            html: `<h3>Click this link to verify your ISESU account<h3><p><a href="${url}">Click Here</a></p>`,
        };
        await sgMail.send(msg);
        // res.redirect(`${process.env.FRONT_END_URL}/login?verified=A verification link has been successfully sent to ${user.email}`);
        return true;
    }
}

module.exports = {
    userRegistrationValidationForm,
    loginFormValidation,
    hashPassword,
    getToken,
    sendEmailVerificationLink
}
