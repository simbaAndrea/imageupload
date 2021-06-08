const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const { fromPath } = require('pdf2pic');
require('dotenv').config();
const libre = require('libreoffice-convert');
const AWS = require("aws-sdk");

const port = process.env.PORT || 8089;
const app = express();

app.use(express.static(path.join(__dirname, 'public')));
app.use(cors());
app.use(express.json());

const download = (url, dest, cb) => {
  const file = fs.createWriteStream(dest);
  const request = https.get(url, (response) => {
    response.pipe(file);
    file.on('finish', () => {
      file.close(cb);
    });
  });

  request.on('error', (e) => {
    console.log(e.message);
  });
}

app.post('/pdf', async (req, res) => {
  const { url } = req.body;
  const fileName = url.substr(url.lastIndexOf('/') + 1, url.length);
  const savedName = fileName.substr(0, fileName.indexOf('.'));
  download(url, 'public/' + fileName, async () => {
    console.log('Done');
    const options = {
      density: 100,
      saveFilename: savedName,
      savePath: "public/thumbnails",
      format: "jpeg",
      width: 649,
      height: 896
    };
    const storeAsImage = fromPath("public/" + fileName, options);
    const pageToConvertAsImage = 1;

    const data = await storeAsImage(pageToConvertAsImage).then((resolve) => {
      fs.unlinkSync('public/' + fileName);
      return resolve;
    });
    const thumbnailPath = data.path;
    if (fs.existsSync(thumbnailPath)) {
      let bucketName = 'mopse';
      let s3 = new AWS.S3({ apiVersion: '2006-03-01' });

      let fileStream = fs.createReadStream(thumbnailPath);
      let fileName = path.basename(thumbnailPath);

      let uploadParams = {
        Bucket: bucketName,
        Key: `document-thumbnails/${fileName}`,
        Body: fileStream,
        ACL: 'public-read'
      };

      s3.upload(uploadParams, function (err, data) {
        fileStream.destroy();
        if (err) {
          console.log("Error", err);
          res.sendStatus(500);
        } if (data) {
          fs.unlinkSync(thumbnailPath);
          res.json(data.Location);
        }
      });
    }
  });
});

app.post('/doc', async (req, res) => {
  const { url, fileName, savedName, ext } = req.body;
  const filePath = 'public/' + fileName + ext;
  const outputPath = 'public/' + fileName + '.pdf';
  download(url, filePath, async () => {
    const file = fs.readFileSync(filePath);
    libre.convert(file, ext, undefined, (err, done) => {
      if (err) {
        console.log(`Error converting file: ${err}`);
      }

      // Here in done you have pdf file which you can save or transfer in another stream
      fs.writeFileSync(outputPath, done);
      console.log('Done ');
    });
  });

});

app.listen(port, () => {
  console.log(`Server started at port ${port}`);
});

