const express = require('express');
const moment = require('moment');
const path = require('path');
const AWS = require("aws-sdk");
const crypto = require('crypto');

const { isAuthenticated } = require('../config/auth');;
const { systemError } = require('../functions/errors');
const { slugify } = require('../functions/general');
const fs = require('fs');

const router = express.Router();

router.post('/', (req, res, next) => {
    try {
        const { folderPath, extension, title } = req.body;
        const reqFile = req.files;
        const user = req.user;
        if (reqFile == undefined) {
            return res.status(400).send('No files were uploaded.');
        }

        if (reqFile.file == undefined) {
            return res.status(400).send('No files were uploaded.');
        }
        
        let file = reqFile.file;
        let ext = extension;
        let date = moment(Date.now()).format('YYYY-MM-DD');
        let randomName = slugify(`${title} ${date}`);
        const fileN = `${randomName}.${ext}`;
    
        let finalFile = `${folderPath}/${fileN}`;
    
        const publicDir = req.app.locals.publicDir;
        const finalFilePath = path.join(publicDir, finalFile);

        let bucketName = 'mopse';
        let s3 = new AWS.S3({ apiVersion: '2006-03-01' });

        let uploadParams = { 
            Bucket: bucketName, 
            Key: `${folderPath}/${path.basename(finalFilePath)}`, 
            Body: file.data, 
            ACL: 'public-read'
        };
        
        s3.upload(uploadParams, function (err, data) {
            if (err) {
                console.log("Error", err);
                res.sendStatus(500);
            } if (data) {
                res.json(data.Location);
            }
        });
        
    } catch (e) {
        next(systemError(e.message));
    }
});

router.post('/move', (req, res, next) => {
    try {
        const { resourceLink, extension, title } = req.body;
        let ext = extension;
        let date = moment(Date.now()).format('YYYY-MM-DD');
        let randomName = slugify(`${title} ${date}`);
        const fileName = `${randomName}.${ext}`;

        const publicDir = req.app.locals.publicDir;
        const finalFilePath = path.join(publicDir, resourceLink);

        if (fs.existsSync(finalFilePath)) {
            let bucketName = 'mopse';
            let s3 = new AWS.S3({ apiVersion: '2006-03-01' });

            var fileStream = fs.createReadStream(finalFilePath);

            let uploadParams = { 
                Bucket: bucketName, 
                Key: `resources/${fileName}`, 
                Body: fileStream, 
                ACL: 'public-read'
            };

            s3.upload(uploadParams, function (err, data) {
                fileStream.destroy();
                if (err) {
                    console.log("Error", err);
                    res.sendStatus(500);
                } if (data) {
                    fs.unlinkSync(finalFilePath);
                    res.json(data.Location);
                }
            });
        } else {
            res.json('');
        }
        
    } catch (e) {
        next(systemError(e.message));
    }
});

module.exports = router;