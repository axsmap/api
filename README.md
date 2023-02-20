# API

[![styled with standard](https://img.shields.io/badge/styled%20with-standard-f3df49.svg?style=flat-square)](https://github.com/standard/standard)
[![formatted with prettier](https://img.shields.io/badge/formatted_with-prettier-ff69b4.svg?style=flat-square)](https://github.com/prettier/prettier)
[![deployed with now](https://img.shields.io/badge/deployed%20with-now-444444.svg?style=flat-square)](https://github.com/zeit/now)


## Deploying API via AWS Elastic Beanstalk

### Deploying new version

1. Zip entire api repo, including `.env` file

2. Navigate to Elastic Beanstalk via the AWS Console

3. Select `Axsprodapi-env` from the available environments

4. Click upload and deploy, and upload the zipped file

### Creating new Elastic Beanstalk instance

*This will not be necessary until AWS stops supporting Node.js 16, and require an upgrade to a newer version*

1. From the Elastic Beanstalk console, create a new environment

2. Select Web Server Envrionment

3. Name Application

4. From managed platfrom choose the Node.js version that you want the environemnt to be running

5. Under Application code, select upload your own code - You will need to zip the repo just like the mentioned in the [Delopying new version](Deploying-new-version) section.

6. (Optional) - Give a custom version label 

7. After environment has been created, navigate to that environment and head to the configuration tab

8. Ensure that all configs match the configs of `Axsprodapi-env` - this environment has everything the way it needs to be including ELB health check configs + inbound security rules

9. Navigate to the Cloudflare console for axsmap.com

10. Under DNS, you will have to replace the CNAME for api to the new Elastic Beanstalk instance URL.
