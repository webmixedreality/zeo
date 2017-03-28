const path = require('path');
const fs = require('fs');
const child_process = require('child_process');

const mkdirp = require('mkdirp');

class Fs {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {express, app, dirname} = archae.getCore();

    const cleanups = [];
    this._cleanup = () => {
      for (let i = 0; i < cleanups.length; i++) {
        const cleanup = cleanups[i];
        cleanup();
      }
    };
    let live = true;
    cleanups.push(() => {
      live = false;
    });

    const fsPath = path.join(dirname, 'data', 'fs');
    const _ensureFsDirectory = () => new Promise((accept, reject) => {
      mkdirp(fsPath, err => {
        if (!err) {
          accept();
        } else {
          reject(err);
        }
      });
    });

    return _ensureFsDirectory()
      .then(() => {
        if (live) {
          const fsStatic = express.static(fsPath);
          function serveFsStatic(req, res, next) {
            const dirname = req.params[0];
            const filePath = req.params[1];

            req.url = '/' + dirname + filePath;

            fsStatic(req, res, next);
          }
          app.get(/^\/fs\/([^\/]+)(\/.+)$/, serveFsStatic);
          function serveFsZip(req, res, next) {
            const dirname = req.params[0];
            const filePath = req.params[1];

            const fullPath = path.join(fsPath, dirname);
            fs.lstat(fullPath, (err, stats) => {
              if (!err) {
                if (stats.isDirectory()) {
                  const zipProcess = child_process.spawn('zip', [
                    '-r',
                    '-',
                    '.',
                  ], {
                    cwd: fullPath,
                  });

                  zipProcess.stdout.pipe(res);
                  zipProcess.stderr.pipe(process.stderr);
                  zipProcess.on('exit', code => {
                    if (code !== 0) {
                      res.status(500);
                      res.send('zip returned non-zero status code: ' + code);
                    }
                  });
                } else {
                  res.status(404);
                  res.send();
                }
              } else if (err.code === 'ENOENT') {
                res.status(404);
                res.send();
              } else {
                res.status(500);
                res.send(err.stack);
              }
            });
          }
          app.get(/^\/fs\/([^\/]+)\.zip$/, serveFsZip);
          function serveFsUpload(req, res, next) {
            const dirname = req.params[0];
            const filePath = req.params[1];

            const fullPath = path.join(fsPath, dirname, filePath);
            mkdirp(path.dirname(fullPath), err => {
              const _ok = () => {
                res.send();
              };
              const _error = err => {
                res.status(500);
                res.send(err.stack);
              };

              if (!err) {
                fs.lstat(fullPath, err => {
                  const _write = () => {
                    const start = (() => {
                      const rangeString = req.get('range');

                      if (rangeString) {
                        const match = rangeString.match(/^bytes=([0-9]+)-$/);

                        if (match) {
                          const rangeValue = parseInt(match[1], 10);

                          if (!isNaN(rangeValue)) {
                            return rangeValue;
                          } else {
                            return 0;
                          }
                        } else {
                          return 0;
                        }
                      } else {
                        return 0;
                      }
                    })();

                    const ws = fs.createWriteStream(fullPath, {
                      flags: 'r+',
                      start: start,
                    });

                    req.pipe(ws);

                    ws.on('finish', _ok);
                    ws.on('error', _error);
                  };

                  if (!err) {
                    _write();
                  } else if (err.code === 'ENOENT') {
                    fs.writeFile(fullPath, '', err => {
                      if (!err) {
                        _write();
                      } else {
                        _error(err);
                      }
                    });
                  } else {
                    _error(err);
                  }
                });
              } else {
                _error(err);
              }
            });
          }
          app.put(/^\/fs\/([^\/]+)(\/.+)$/, serveFsUpload);

          cleanups.push(() => {
            function removeMiddlewares(route, i, routes) {
              if (
                route.handle.name === 'serveFsStatic' ||
                route.handle.name === 'serveFsZip' ||
                route.handle.name === 'serveFsUpload'
              ) {
                routes.splice(i, 1);
              }
              if (route.route) {
                route.route.stack.forEach(removeMiddlewares);
              }
            }
            app._router.stack.forEach(removeMiddlewares);
          });
        }
      });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Fs;
