const path = require('path');

class Tutorial {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {express, app} = archae.getCore();

    const tutorialImgStatic = express.static(path.join(__dirname, 'lib', 'img'));
    function tutorialImg(req, res, next) {
      tutorialImgStatic(req, res, next);
    }
    app.use('/archae/tutorial/img', tutorialImg);

    this._cleanup = () => {
      function removeMiddlewares(route, i, routes) {
        if (route.handle.name === 'serveTutorialImg') {
          routes.splice(i, 1);
        }
        if (route.route) {
          route.route.stack.forEach(removeMiddlewares);
        }
      }
      app._router.stack.forEach(removeMiddlewares);
    };
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Tutorial;
