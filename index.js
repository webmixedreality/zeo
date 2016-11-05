const path = require('path');
const fs = require('fs');
const child_process = require('child_process');

const express = require('express');
const ws = require('ws');
const mkdirp = require('mkdirp');
const rimraf = require('rimraf');

class ArchaeServer {
  constructor(options) {
    options = options || {};

    this._options = options;
  }

  addPlugin(plugin, opts, cb) {
    if (cb === undefined) {
      cb = opts;
      opts = {};
    }

    if (opts.force) {
      _removePlugin(plugin, err => {
        if (!err) {
          _addPlugin(plugin, cb);
        } else {
          cb(err);
        }
      });
    } else {
      _addPlugin(plugin, cb);
    }
  }
  
  removePlugin(plugin, opts, cb) {
    if (cb === undefined) {
      cb = opts;
      opts = {};
    }

    _removePlugin(plugin, cb);
  }

  listen({server, app}) {
    server = server || http.createServer();
    app = app || express();

    const {_options: options} = this;

    app.use('/', express.static(path.join(__dirname, 'public')));
    server.on('request', app);

    const wss = new ws.Server({
      server,
    });
    wss.on('connection', c => {
      console.log('connection open');

      c.on('message', s => {
        const m = JSON.parse(s);

        const cb = err => {
          console.warn(err);
        };

        if (typeof m === 'object' && m && typeof m.type === 'string' && typeof m.id === 'string') {
          const cb = (err = null, result = null) => {
            const o = {
              id: m.id,
              error: err,
              result: result,
            };
            const s = JSON.stringify(o);
            c.send(s);
          };

          if (m.type === 'addPlugin') {
            const {plugin} = m;

            if (_isValidPlugin(plugin)) {
              _addPlugin(plugin, cb);
            } else {
              cb('invalid plugin spec');
            }
          } else if (m.type === 'removePlugin') {
            const {plugin} = m;

            if (_isValidPlugin(plugin)) {
              _removePlugin(plugin, cb);
            } else {
              cb('invalid plugin spec');
            }
          } else {
            cb('invalid message type');
          }
        } else {
          cb('invalid message');
        }
      });
      c.on('close', () => {
        console.log('connection close');
      });
    });
  }
}

const _addPlugin = (plugin, cb) => {
  const _downloadPlugin = (plugin, cb) => {
    _yarnAdd(plugin, err => {
      if (!err) {
        const pluginPath = _getPluginPath(plugin);
        fs.readFile(path.join(pluginPath, 'package.json'), 'utf8', (err, s) => {
          if (!err) {
            const j = JSON.parse(s);
            cb(null, j);
          } else {
            cb(err);
          }
        });
      } else {
        cb(err);
      }
    });
  };
  const _yarnAdd = (plugin, cb) => {
    const yarnAdd = child_process.spawn(
      'yarn',
      [ 'add', plugin ],
      {
        cwd: path.join(__dirname, 'plugins'),
      }
    );
    yarnAdd.stdout.pipe(process.stdout);
    yarnAdd.stderr.pipe(process.stderr);
    yarnAdd.on('close', code => {
      if (code === 0) {
        cb();
      } else {
        const err = new Error('yard add error: ' + code);
        cb(err);
      }
    });
  };
  const _yarnInstall = (plugin, cb) => {
    const pluginPath = _getPluginPath(plugin);

    const yarnInstall = child_process.spawn(
      'yarn',
      [ 'install' ],
      {
        cwd: pluginPath,
      }
    );
    yarnInstall.stdout.pipe(process.stdout);
    yarnInstall.stderr.pipe(process.stderr);
    yarnInstall.on('close', code => {
      if (code === 0) {
        cb();
      } else {
        const err = new Error('yard install error: ' + code);
        cb(err);
      }
    });
  };
  const _dumpPlugin = (plugin, cb) => {
    const {name, version = '0.0.1', dependencies = {}, client = 'client.js', server = 'server.js', files} = plugin;

    if (_isValidPluginSpec(plugin)) {
      const pluginPath = _getPluginPath(plugin.name);

      mkdirp(pluginPath, err => {
        if (!err) {
          const packageJson = {
            name,
            version,
            dependencies,
            client,
            server,
          };
          const packageJsonString = JSON.stringify(packageJson, null, 2);

          fs.writeFile(path.join(pluginPath, 'package.json'), packageJsonString, 'utf8', err => {
            if (!err) {
              _yarnInstall(plugin.name, err => {
                if (!err) {
                  if (_isValidFiles(files)) {
                    const fileNames = Object.keys(files);

                    if (fileNames.length > 0) {
                      let pending = fileNames.length;
                      const pend = () => {
                        if (--pending === 0) {
                          cb();
                        }
                      };

                      for (let i = 0; i < fileNames.length; i++) {
                        const fileName = fileNames[i];
                        const fileData = files[fileName];

                        fs.writeFile(path.join(pluginPath, fileName), fileData, 'utf8', pend);
                      }
                    } else {
                      cb();
                    }
                  } else {
                    cb(err);
                  }
                } else {
                  cb();
                }
              });
            } else {
              cb(err);
            }
          });
        } else {
          cb(err);
        }
      });
    } else {
      const err = new Error('invalid plugin declaration');
      cb(err);
    }
  };
  const _buildPlugin = (plugin, cb) => {
    const pluginClientPath = _getPluginClientPath(plugin);
    const pluginBuildPath = _getPluginBuildPath(plugin);

    const webpack = child_process.spawn(
      path.join(__dirname, 'node_modules', 'webpack', 'bin', 'webpack.js'),
      [ pluginClientPath, pluginBuildPath ],
      {
        cwd: __dirname,
      }
    );
    webpack.stdout.pipe(process.stdout);
    webpack.stderr.pipe(process.stderr);
    webpack.on('close', code => {
      if (code === 0) {
        cb();
      } else {
        const err = new Error('webpack error: ' + code);
        cb(err);
      }
    });
  };

  mkdirp(path.join(__dirname, 'plugins'), err => {
    if (!err) {
      const pluginBuildPath = _getPluginBuildPath(plugin);

      fs.exists(pluginBuildPath, exists => {
        if (!exists) {
          if (typeof plugin === 'string') {
            _downloadPlugin(plugin, (err, packageJson) => {
              if (!err) {
                _buildPlugin(packageJson, cb);
              } else {
                cb(err);
              }
            });
          } else if (typeof plugin === 'object') {
            _dumpPlugin(plugin, err => {
              if (!err) {
                _buildPlugin(plugin, cb);
              } else {
                cb(err);
              }
            });
          } else {
            const err = new Error('invalid plugin format');
            cb(err);
          }
        } else {
          cb();
        }
      });
    } else {
      console.warn(err);
    }
  });
};

const _removePlugin = (plugin, cb) => {
  if (typeof plugin === 'string') {
    const pluginPath = _getPluginPath(plugin);

    rimraf(pluginPath, err => {
      if (!err) {
        const pluginBuildPath = _getPluginBuildPath(plugin);

        rimraf(pluginBuildPath, cb);
      } else {
        cb(err);
      }
    });
  } else if (typeof plugin ==='object') {
    if (plugin && typeof plugin.name === 'string') {
      const pluginBuildPath = _getPluginBuildPath(plugin.name);

      rimraf(pluginBuildPath, cb);
    } else {
      const err = new Error('invalid plugin declaration');
      cb(err);
    }
  } else {
    const err = new Error('invalid plugin format');
    cb(err);
  }
};

const _getPluginName = plugin => {
  if (typeof plugin === 'string') {
    return plugin;
  } else if (_isValidPluginSpec(plugin)) {
    return plugin.name;
  } else {
    return null;
  }
};
const _getPluginPath = plugin => path.join(__dirname, 'plugins', 'node_modules', _getPluginName(plugin));
const _getPluginClientPath = plugin => {
  const pluginPath = _getPluginPath(plugin);

  if (typeof plugin === 'string') {
    return pluginPath;
  } else if (_isValidPluginSpec(plugin)) {
    const {client} = plugin;
    if (client) {
      return path.join(pluginPath, client);
    } else {
      const {main = 'index.js'} = plugin;
      return path.join(pluginPath, main);
    }
  } else {
    return null;
  }
};
const _getPluginBuildPath = plugin => path.join(__dirname, 'plugins', 'build', _getPluginName(plugin) + '.js');

const _isValidPlugin = plugin => typeof plugin === 'string' || _isValidPluginSpec(plugin);
const _isValidPluginSpec = plugin => {
  const {name, version = '', dependencies = {}, client = '', server = ''} = plugin;

  return typeof name === 'string' &&
    typeof version === 'string' &&
    typeof client === 'string' &&
    typeof server === 'string' &&
    _isValidDependencies(dependencies);
};
const _isValidDependencies = dependencies => {
  if (dependencies && typeof dependencies === 'object' && !Array.isArray(dependencies)) {
    for (const k in dependencies) {
      const v = dependencies[k];
      if (typeof v !== 'string') {
        return false;
      }
    }
    return true;
  } else {
    return false;
  }
};

const _isValidFiles = files => {
  if (files && typeof files === 'object' && !Array.isArray(files)) {
    for (const k in files) {
      const v = files[k];
      if (typeof v !== 'string') {
        return false;
      }
    }
    return true;
  } else {
    return false;
  }
};

const archae = (opts) => new ArchaeServer(opts);

module.exports = archae;
