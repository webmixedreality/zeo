const CakeModel = require('./lib/models/cake');

const GRAB_RADIUS = 0.2;

const SIDES = ['left', 'right'];

class ZCake {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;

    let live = true;
    this._cleanup = () => {
      live = false;
    };

    const _requestAudios = () => new Promise((accept, reject) => {
      const eatAudio = document.createElement('audio');
      eatAudio.src = '/archae/z-cake/audio/eat.mp3';
      eatAudio.oncanplaythrough = () => {
        accept({
          eatAudio,
        });
      };
      eatAudio.onerror = err => {
        reject(err);
      };
    });

    return Promise.all([
      archae.requestPlugins([
        '/core/engines/zeo',
      ]),
      _requestAudios(),
    ]).then(([
      [
        zeo,
      ],
      {
        eatAudio,
      },
    ]) => {
      if (live) {
        const {THREE, scene} = zeo;

        class CakeElement extends HTMLElement {
          createdCallback() {
            this.position = null;
            this.slices = 0;

            this.mesh = null;
            this.sliceSide = null;
            this.sliceMesh = null;

            const _gripdown = e => {
              const {side} = e;
              const {mesh} = this;

              const canGrab = zeo.canGrab(side, mesh, {
                radius: GRAB_RADIUS,
              });

              if (canGrab) {
                const sliceMesh = new CakeModel({
                  THREE,
                  slices: 1,
                });
                sliceMesh.rotation.y = -(1/8 * Math.PI);
                sliceMesh.position.z = -0.2;
                zeo.grab(side, sliceMesh);
                this.sliceSide = side;
                this.sliceMesh = sliceMesh;

                this.setAttribute('slices', this.slices - 1);

                e.stopImmediatePropagation();
              }
            };
            zeo.on('gripdown', _gripdown, {
              priority: 1,
            });
            const _release = e => {
              const {side, object} = e;
              const {sliceSide, sliceMesh} = this;

              if (side === sliceSide && object === sliceMesh) {
                this.sliceSide = null;
                this.sliceMesh = null;

                eatAudio.currentTime = 0;
                if (eatAudio.paused) {
                  eatAudio.play();
                }
              }
            };
            zeo.on('release', _release);

            this._cleanup = () => {
              const {mesh} = this;
              scene.remove(mesh);

              const {sliceSide, sliceMesh} = this;
              if (sliceSide && sliceMesh) {
                zeo.release(sliceSide, sliceMesh);
              }

              zeo.removeListener('gripdown', _gripdown);
              zeo.removeListener('release', _release);
            };
          }

          destructor() {
            this._cleanup();
          }

          attributeValueChangedCallback(name, oldValue, newValue) {
            switch (name) {
              case 'position': {
                this.position = newValue;

                this._updateMesh();

                break;
              }
              case 'slices': {
                this.slices = newValue;

                this._render();

                break;
              }
            }
          }

          _render() {
            const {mesh: oldMesh} = this;
            if (oldMesh) {
              scene.remove(oldMesh);
            }

            const {slices} = this;
            const newMesh = new CakeModel({
              THREE,
              slices,
            });
            scene.add(newMesh);
            this.mesh = newMesh;

            this._updateMesh();
          }

          _updateMesh() {
            const {mesh, position} = this;

            if (mesh && position) {
              mesh.position.set(position[0], position[1], position[2]);
              mesh.quaternion.set(position[3], position[4], position[5], position[6]);
              mesh.scale.set(position[7], position[8], position[9]);
            }
          }
        }
        zeo.registerElement(this, CakeElement);

        const updates = [];
        const _update = () => {
          for (let i = 0; i < updates.length; i++) {
            const update = updates[i];
            update();
          }
        };
        zeo.on('update', _update);

        this._cleanup = () => {
          zeo.unregisterElement(this);
        };

        return {};
      }
    });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = ZCake;
