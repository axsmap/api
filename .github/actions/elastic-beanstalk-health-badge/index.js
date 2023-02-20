const AWS = require('aws-sdk');
const https = require('https');
const fs = require('fs');

const environmentName = process.env.ELASTIC_BEANSTALK_ENVIRONMENT_NAME;
const region = process.env.AWS_REGION;

const elasticbeanstalk = new AWS.ElasticBeanstalk({region: region});

elasticbeanstalk.describeEnvironmentHealth({EnvironmentName: environmentName}, function(err, data) {
  if (err) {
    console.log(err, err.stack);
    process.exit(1);
  } else {
    const color = data.Color;
    const svgPath = `./badge-${color}.svg`;
    const badgeUrl = `https://img.shields.io/badge/Elastic%20Beanstalk-${color}-brightgreen.svg`;

    https.get(badgeUrl, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        fs.writeFileSync(svgPath, body);
        console.log(`::set-output name=badge::${svgPath}`);
      });
    });
  }
});
