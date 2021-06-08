const express = require('express');
const moment = require('moment');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const { isAuthenticated } = require('../config/auth');
const { slugify } = require('../functions/general');
const { systemError } = require('../functions/errors');
const router = express.Router();
const AWS = require("aws-sdk");

router.post('/', isAuthenticated, async (req, res, next) => {
    try {
        sharp.cache(false);
        const { imagePath, extension, title } = req.body;
        const reqFile = req.files;
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

        let finalFile = `${imagePath}/${fileN}`;
        let croppedFilePath = `${imagePath}/thumbnails/${randomName}.jpeg`;

        const publicDir = req.app.locals.publicDir;
        const finalImage = path.join(publicDir, finalFile);
        const finalCroppedImagePath = path.join(publicDir, croppedFilePath);

        const image = sharp(file.data);
        const imageData = await image.resize(250, 250).jpeg().toBuffer();

        // S3 Implemantation
        let bucketName = 'mopse';
        let s3 = new AWS.S3({ apiVersion: '2006-03-01' });
        let uploadParams = { 
            Bucket: bucketName, 
            Key: `user/original/${path.basename(finalImage)}`, 
            Body: file.data, 
            ACL: 'public-read' 
        };

        let uploadCroppedParams = { 
            Bucket: bucketName, 
            Key: `users/thumbnails/${path.basename(finalCroppedImagePath)}`, 
            Body: imageData, 
            ACL: 'public-read' 
        };

        s3.upload(uploadParams, function (err, data) {
            if (err) {
                console.log("Error", err);
                res.sendStatus(500);
            } if (data) {
                let original = data.Location;
                s3.upload(uploadCroppedParams, function (err, data) {
                    if (err) {
                        console.log("Error", err);
                        res.sendStatus(500);
                    } if (data) {
                        let responseData = { original: original, thumbnail: data.Location };
                        console.log(responseData);
                        res.json(responseData);
                    }
                });
            }
        });
    } catch (e) {
        console.log(e.message);
        next(systemError(e.message));
    }
});

router.get('/test-aws', async (req, res) => {
    var bucketName = 'mopse';

    var keyName = 'hello_world.txt';

    // Create params for putObject call
    var objectParams = { Bucket: bucketName, Key: keyName, Body: 'Hello World!' };
    // Create object upload promise
    var uploadPromise = new AWS.S3({ apiVersion: '2006-03-01' }).putObject(objectParams).promise();
    const data = await uploadPromise;
    console.log(data);
    res.send("Successfully uploaded data to " + bucketName + "/" + keyName);
});

router.post('/crop', isAuthenticated, async (req, res, next) => {
    try {
        sharp.cache(false);
        const { originalImageUrl, croppedImageUrl, cropDetails } = req.body;

        let { width, height, x, y } = cropDetails;
        x = x < 0 ? 0 : x;
        y = y < 0 ? 0 : y;

        const publicDir = req.app.locals.publicDir;
        const originalImage = path.join(publicDir, originalImageUrl);
        const finalCroppedImagePath = path.join(publicDir, croppedImageUrl);

        const image = sharp(originalImage);
        const data = await image
            .extract({ left: parseInt(x, 10), top: parseInt(y, 10), width: parseInt(width, 10), height: parseInt(height, 10) })
            .resize(250, 250).jpeg().toBuffer();

        fs.writeFile(finalCroppedImagePath, data, (err) => {
            if (err) {
                next(systemError(err.message));
            } else {
                res.sendStatus(201);
            }
        });
    } catch (e) {
        next(systemError(e.message));
    }
});

module.exports = router;