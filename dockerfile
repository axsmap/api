FROM node:7.10.1
WORKDIR /app
ADD package.json yarn.lock /app/
RUN yarn install
COPY . /app
CMD yarn serve
EXPOSE 8000