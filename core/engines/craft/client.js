const DIRECTIONS = [
  [-1, -1, -1],
  [-1, -1, 1],
  [-1, 1, -1],
  [-1, 1, 1],

  [1, -1, -1],
  [1, -1, 1],
  [1, 1, -1],
  [1, 1, 1],
];
const SIDES = ['left', 'right'];

class Craft {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;

    let live = true;
    this._cleanup = () => {
      live = false;
    };

    return archae.requestPlugins([
      '/core/engines/three',
      '/core/engines/webvr',
      '/core/engines/input',
      '/core/engines/rend',
      '/core/engines/multiplayer',
      '/core/utils/js-utils',
    ]).then(([
      three,
      webvr,
      input,
      rend,
      multiplayer,
      jsUtils,
    ]) => {
      if (live) {
        const {THREE, scene, camera} = three;
        const {events} = jsUtils;
        const {EventEmitter} = events;

        const localUserId = multiplayer.getId();

        const oneVector = new THREE.Vector3(1, 1, 1);
        const upVector = new THREE.Vector3(0, 1, 0);
        const size = 0.15;

        const spacing = size / 4;
        const width = 3;

        const directions = DIRECTIONS.map(direction => new THREE.Vector3().fromArray(direction).multiplyScalar(size / 2));
        const craftShader = {
          uniforms: {
            gselected: {
              type: 'v2',
              value: new THREE.Vector2(-1, -1),
            },
          },
          vertexShader: [
            "attribute float selected;",
            "varying float vselected;",
            "void main() {",
            "  gl_Position = projectionMatrix * modelViewMatrix * vec4(position.x, position.y, position.z, 1.0);",
            "  vselected = selected;",
            "}"
          ].join("\n"),
          fragmentShader: [
            "uniform vec2 gselected;",
            "varying float vselected;",
            "void main() {",
            "  if (abs(gselected.x - vselected) < 0.1 || abs(gselected.y - vselected) < 0.1) {",
            "    gl_FragColor = vec4(0.12941176470588237, 0.5882352941176471, 0.9529411764705882, 1.0);",
            "  } else {",
            "    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);",
            "  }",
            "}"
          ].join("\n")
        };
        const gridMaterial = new THREE.ShaderMaterial({
          uniforms: THREE.UniformsUtils.clone(craftShader.uniforms),
          vertexShader: craftShader.vertexShader,
          fragmentShader: craftShader.fragmentShader,
          // transparent: true,
          // depthWrite: false,
        });

        const _copyIndices = (src, dst, startIndexIndex, startAttributeIndex) => {
          for (let i = 0; i < src.length; i++) {
            dst[startIndexIndex + i] = src[i] + startAttributeIndex;
          }
        };
        const _getGridPosition = (x, y) => new THREE.Vector3(
          -(((width * size) + ((width - 1) * spacing)) / 2) + (size / 2) + (x * (size + spacing)),
          (((width * size) + ((width - 1) * spacing)) / 2) - (size / 2) - (y * (size + spacing)),
          0
        );
        const _sq = n => Math.sqrt(n*n*2);

        const gridGeometry = (() => {
          const cylinderGeometry = new THREE.CylinderBufferGeometry(0.002, 0.002, size, 3, 1);
          const boxGeometry = (() => {
            const positions = new Float32Array(cylinderGeometry.getAttribute('position').array.length * 4 * 3);
            const indices = new Uint16Array(cylinderGeometry.index.array.length * 4 * 3);
            let attributeIndex = 0;
            let indexIndex = 0;

            for (let i = 0; i < directions.length; i++) {
              const direction1 = directions[i];

              for (let j = 0; j < directions.length; j++) {
                const direction2 = directions[j];
                const diff = direction2.clone().sub(direction1);
                diff.x = Math.abs(diff.x);
                diff.y = Math.abs(diff.y);
                diff.z = Math.abs(diff.z);

                const position = direction1.clone()
                  .add(direction2)
                  .divideScalar(2);
                const newPositions = (() => {
                  if (diff.x === size && diff.y === 0 && diff.z === 0 && direction1.x < 0 && direction2.x > 0) {
                    return cylinderGeometry.clone()
                      .applyMatrix(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(
                        new THREE.Vector3(0, 1, 0),
                        new THREE.Vector3(1, 0, 0)
                      )))
                      .applyMatrix(new THREE.Matrix4().makeTranslation(position.x, position.y, position.z))
                      .getAttribute('position').array;
                  } else if (diff.x === 0 && diff.y === size && diff.z === 0 && direction1.y < 0 && direction2.y > 0) {
                    return cylinderGeometry.clone()
                      .applyMatrix(new THREE.Matrix4().makeTranslation(position.x, position.y, position.z))
                      .getAttribute('position').array;
                  } else if (diff.x === 0 && diff.y === 0 && diff.z === size && direction1.z < 0 && direction2.z > 0) {
                    return cylinderGeometry.clone()
                      .applyMatrix(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(
                        new THREE.Vector3(0, 1, 0),
                        new THREE.Vector3(0, 0, 1)
                      )))
                      .applyMatrix(new THREE.Matrix4().makeTranslation(position.x, position.y, position.z))
                      .getAttribute('position').array;
                  } else {
                    return null;
                  }
                })();
                if (newPositions !== null) {
                  positions.set(newPositions, attributeIndex);
                  const newIndices = cylinderGeometry.index.array;
                  _copyIndices(newIndices, indices, indexIndex, attributeIndex / 3);

                  attributeIndex += newPositions.length;
                  indexIndex += newIndices.length;
                }
              }
            }

            const geometry = new THREE.BufferGeometry();
            geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
            geometry.setIndex(new THREE.BufferAttribute(indices, 1));
            return geometry;
          })();
          const gridGeometry = (() => {
            const positions = new Float32Array(boxGeometry.getAttribute('position').array.length * width * width);
            const selecteds = new Float32Array(boxGeometry.getAttribute('position').array.length / 3 * width * width);
            const indices = new Uint16Array(boxGeometry.index.array.length * width * width);
            let attributeIndex = 0;
            let selectedIndex = 0;
            let indexIndex = 0;

            for (let x = 0; x < width; x++) {
              for (let y = 0; y < width; y++) {
                const position = _getGridPosition(x, y);
                const index = x + (y * width);

                const newPositions = boxGeometry.clone()
                  .applyMatrix(new THREE.Matrix4().makeTranslation(position.x, position.y, position.z))
                  .getAttribute('position').array;
                positions.set(newPositions, attributeIndex);
                const newSelecteds = (() => {
                  const numNewPositions = newPositions.length / 3;
                  const result = new Float32Array(numNewPositions);
                  for (let i = 0; i < numNewPositions; i++) {
                    result[i] = index;
                  }
                  return result;
                })();
                selecteds.set(newSelecteds, selectedIndex);
                const newIndices = boxGeometry.index.array;
                _copyIndices(newIndices, indices, indexIndex, attributeIndex / 3);

                attributeIndex += newPositions.length;
                selectedIndex += newSelecteds.length;
                indexIndex += newIndices.length;
              }
            }

            const geometry = new THREE.BufferGeometry();
            geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
            geometry.addAttribute('selected', new THREE.BufferAttribute(selecteds, 1));
            geometry.setIndex(new THREE.BufferAttribute(indices, 1));
            return geometry;
          })();

          return gridGeometry;
        })();

        const gridMesh = (() => {
          const mesh = new THREE.Mesh(gridGeometry, gridMaterial);
          mesh.visible = false;

          const positions = Array(width * width);
          for (let i = 0; i < positions.length; i++) {
            positions[i] = new THREE.Vector3();
          }
          mesh.positions = positions;
          mesh.updatePositions = () => {
            const {position, quaternion, scale} = mesh;

            for (let y = 0; y < width; y++) {
              for (let x = 0; x < width; x++) {
                const index = x + (y * width);
                const p = _getGridPosition(x, y)
                  .multiply(scale)
                  .applyQuaternion(quaternion)
                  .add(position);
                positions[index].copy(p);
              }
            }
          };

          return mesh;
        })();
        scene.add(gridMesh);

        const _triggerdown = e => {
          const {side} = e;
          const status = webvr.getStatus();
          const {gamepads} = status;
          const gamepad = gamepads[side];

          if (gamepad.buttons.grip.pressed) {
            const {worldPosition: controllerPosition} = gamepad;

            if (!gridMesh.visible) {
              const {hmd} = status;
              const {worldPosition: hmdPosition} = hmd;
              const hmdEuler = new THREE.Euler().setFromQuaternion(
                new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(
                  hmdPosition,
                  controllerPosition,
                  upVector
                )),
                camera.rotation.order
              );
              hmdEuler.x = 0;
              hmdEuler.y += Math.PI;
              hmdEuler.z = 0;
              const hmdQuaternion = new THREE.Quaternion().setFromEuler(hmdEuler);

              gridMesh.position.copy(controllerPosition);
              gridMesh.quaternion.copy(hmdQuaternion);
              gridMesh.scale.copy(oneVector);
              gridMesh.updateMatrixWorld();
              gridMesh.visible = true;

              gridMesh.updatePositions();

              craftApi.open();
            } else {
              const index = _getHoveredIndex(controllerPosition);

              if (index !== -1) {
                craftApi.trigger(side, index);
              } else {
                craftApi.close();
                _resetGrid();

                gridMesh.visible = false;
              }
            }

            e.stopImmediatePropagation();
          }
        };
        input.on('triggerdown', _triggerdown, {
          priority: 0,
        });

        const _gripdown = e => {
          const {side} = e;
          const {gamepads} = webvr.getStatus();
          const gamepad = gamepads[side];
          const {worldPosition: controllerPosition} = gamepad;
          const index = _getHoveredIndex(controllerPosition);

          if (index !== -1) {
            craftApi.grip(side, index);

            e.stopImmediatePropagation();
          }
        };
        input.on('gripdown', _gripdown, {
          priority: 0,
        });

        const hoverDistance = (size + spacing) / 2;
        const _getHoveredIndex = p => {
          if (gridMesh.visible) {
            const {positions} = gridMesh;

            for (let j = 0; j < positions.length; j++) {
              const position = positions[j];
              const distance = p.distanceTo(position);

              if (distance < hoverDistance) {
                return j;
              }
            }
            return -1;
          } else {
            return -1;
          }
        };

        const grid = Array(width * width);
        const _resetGrid = () => {
          for (let i = 0; i < grid.length; i++) {
            grid[i] = null;
          }
        };
        _resetGrid();

        const _update = () => {
          if (gridMesh.visible) {
            const status = webvr.getStatus();
            const {hmd} = status;
            const {worldPosition: hmdPosition} = hmd;

            if (hmdPosition.distanceTo(gridMesh.position) < 3) {
              for (let i = 0; i < SIDES.length; i++) {
                const side = SIDES[i];
                const {gamepads} = status;
                const gamepad = gamepads[side];
                const {worldPosition: controllerPosition} = gamepad;
                const index = _getHoveredIndex(controllerPosition);
                gridMesh.material.uniforms.gselected.value[side === 'left' ? 'x' : 'y'] = index;
              }
            } else {
              gridMesh.visible = false;
            }
          }
        };
        rend.on('update', _update);

        this._cleanup = () => {
          scene.remove(gridMesh);

          gridGeometry.dispose();
          gridMaterial.dispose();

          input.removeListener('triggerdown', _triggerdown);
          input.removeListener('gripdown', _gripdown);
          rend.removeListener('update', _update);
        };

        class CraftApi extends EventEmitter {
          getHoveredGridIndex(side) {
            const {gamepads} = webvr.getStatus();
            const gamepad = gamepads[side];
            const {worldPosition: controllerPosition} = gamepad;
            return _getHoveredIndex(controllerPosition);
          }

          getGrid() {
            return grid;
          }

          getGridIndex(index) {
            return grid[index];
          }

          getGridIndexPosition(index) {
            return gridMesh.positions[index];
          }

          setGridIndex(index, item) {
            grid[index] = item;
          }

          open() {
            this.emit('open');
          }

          close() {
            this.emit('close');
          }

          trigger(side, index) {
            this.emit('trigger', {side, index});
          }

          grip(side, index) {
            this.emit('grip', {side, index});
          }
        }
        const craftApi = new CraftApi();

        return craftApi;
      }
    });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Craft;
