const gulp = require('gulp');
const eslint = require('gulp-eslint');
const nodemon = require('gulp-nodemon');

const paths = {
  srcApp: 'src/index.js',
  srcFiles: 'src/**/*.js'
};

gulp.task('lint', () =>
  gulp
    .src(paths.srcFiles)
    .pipe(eslint())
    .pipe(eslint.format())
);

gulp.task('serve', ['lint'], () =>
  nodemon({
    exec: 'node',
    script: paths.srcApp,
    tasks: 'lint',
    watch: paths.srcFiles
  })
);

gulp.task('default', ['serve']);
