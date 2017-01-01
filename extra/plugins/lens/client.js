const EffectComposer = require('./lib/three-extra/postprocessing/EffectComposer');
const RenderPass = require('./lib/three-extra/postprocessing/RenderPass');
const ShaderPass = require('./lib/three-extra/postprocessing/ShaderPass');
const CopyShader = require('./lib/three-extra/shaders/CopyShader');
const HorizontalBlurShader = require('./lib/three-extra/shaders/HorizontalBlurShader');
const VerticalBlurShader = require('./lib/three-extra/shaders/VerticalBlurShader');

const width = 0.1;
const height = 0.1;
const pixelWidth = 128;
const pixelHeight = 128;

const LENS_SHADER = {
  uniforms: {
    textureMap: {
      type: 't',
      value: null,
    },
    lightness: {
      type: 'f',
      value: 0,
    },
  },
  vertexShader: [
    "varying vec4 texCoord;",
    "void main() {",
    "  vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );",
    "  vec4 position = projectionMatrix * mvPosition;",
    "  texCoord = position;",
    "  texCoord.xy = 0.5*texCoord.xy + 0.5*texCoord.w;",
    "  gl_Position = position;",
    "}"
  ].join("\n"),
  fragmentShader: [
    "uniform sampler2D textureMap;",
    "uniform float lightness;",
    "varying vec4 texCoord;",
    "void main() {",
    "  vec4 diffuse = texture2DProj(textureMap, texCoord);",
    "  gl_FragColor = vec4(mix(diffuse.rgb, vec3(1, 1, 1), lightness), diffuse.a);",
    "}"
  ].join("\n")
};

class Lens {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;

    let live = true;
    this._cleanup = () => {
      live = false;
    };

    return archae.requestEngines([
      '/core/engines/zeo',
    ]).then(([
      zeo,
    ]) => {
      if (live) {
        const {THREE, scene, camera, renderer} = zeo;
        EffectComposer(THREE); // XXX need to constantize these
        RenderPass(THREE);
        ShaderPass(THREE);
        CopyShader(THREE);
        HorizontalBlurShader(THREE);
        VerticalBlurShader(THREE);

        const updateEyes = [];
        const _updateEye = () => {
          for (let i = 0; i < updateEyes.length; i++) {
            const updateEye = updateEyes[i];
            updateEye();
          }
        };

        const lineMaterial = new THREE.LineBasicMaterial({
          color: 0x000000,
        });

        return {
          updateEye: _updateEye,
          elements: [
            class LensElement {
              static get tag() {
                return 'lens';
              }
              static get attributes() {
                return {
                  position: {
                    type: 'matrix',
                    value: [
                      0, 0, 0,
                      0, 0, 0, 1,
                      1, 1, 1,
                    ],
                  },
                };
              }

              constructor() {
                const _makeRenderTarget = (width, height) => new THREE.WebGLRenderTarget(width, height, {
                  minFilter: THREE.NearestFilter,
                  magFilter: THREE.NearestFilter,
                  // format: THREE.RGBFormat,
                  format: THREE.RGBAFormat,
                });

                const planeGeometry = new THREE.PlaneBufferGeometry(width, height, 1, 1);

                const lineGeometry = (() => {
                  const result = new THREE.BufferGeometry();

                  const positions = Float32Array.from([
                    -width / 2, height / 2, 0,
                    width / 2, height / 2, 0,
                    width / 2, -height / 2, 0,
                    -width / 2, -height / 2, 0,
                    -width / 2, height / 2, 0, // loop back to start
                  ]);
                  result.addAttribute('position', new THREE.BufferAttribute(positions, 3));

                  return result;
                })();
                const _makeLineMesh = () => new THREE.Line(lineGeometry, lineMaterial);

                const blurLensMesh = (() => {
                  const object = new THREE.Object3D();
                  object.position.set(0, 1.4 - (0 * 0.2), -0.1);

                  const width = window.innerWidth * window.devicePixelRatio / 4;
                  const height = window.innerHeight * window.devicePixelRatio / 4;
                  const renderTarget = _makeRenderTarget(width, height);
                  const render = (() => {
                    const horizontalBlurShader = {
                      uniforms: (() => {
                        const result = THREE.UniformsUtils.clone(THREE.HorizontalBlurShader.uniforms);
                        result.h.value = 1 / width;
                        return result;
                      })(),
                      vertexShader: THREE.HorizontalBlurShader.vertexShader,
                      fragmentShader: THREE.HorizontalBlurShader.fragmentShader,
                    };
                    const verticalBlurShader = {
                      uniforms: (() => {
                        const result = THREE.UniformsUtils.clone(THREE.VerticalBlurShader.uniforms);
                        result.v.value = 1 / height;
                        return result;
                      })(),
                      vertexShader: THREE.VerticalBlurShader.vertexShader,
                      fragmentShader: THREE.VerticalBlurShader.fragmentShader,
                    };

                    const composer = new THREE.EffectComposer(renderer, renderTarget);
                    const renderPass = new THREE.RenderPass(scene, camera);
                    composer.addPass(renderPass);
                    const hblur = new THREE.ShaderPass(horizontalBlurShader);
                    composer.addPass(hblur);
                    composer.addPass(hblur);
                    const vblur = new THREE.ShaderPass(verticalBlurShader);
                    composer.addPass(vblur);
                    const vblurFinal = new THREE.ShaderPass(verticalBlurShader);
                    // vblurFinal.renderToScreen = true;

                    composer.addPass(vblurFinal);

                    return (scene, camera) => {
                      renderPass.scene = scene;
                      renderPass.camera = camera;

                      composer.render();
                      renderer.setRenderTarget(null);
                    };
                  })();
                  object.render = render;

                  const planeMesh = (() => {
                    const geometry = planeGeometry;
                    const material = (() => {
                      const shaderUniforms = THREE.UniformsUtils.clone(LENS_SHADER.uniforms);
                      shaderUniforms.lightness.value = 0.25;
                      const shaderMaterial = new THREE.ShaderMaterial({
                        uniforms: shaderUniforms,
                        vertexShader: LENS_SHADER.vertexShader,
                        fragmentShader: LENS_SHADER.fragmentShader,
                      })
                      shaderMaterial.uniforms.textureMap.value = renderTarget.texture;
                      // shaderMaterial.polygonOffset = true;
                      // shaderMaterial.polygonOffsetFactor = -1;
                      return shaderMaterial;
                    })();

                    const mesh = new THREE.Mesh(geometry, material);
                    return mesh;
                  })();
                  object.add(planeMesh);
                  object.planeMesh = planeMesh;

                  const lineMesh = _makeLineMesh();
                  object.add(lineMesh);
                  object.lineMesh = lineMesh;

                  return object;
                })();

                const pixelLensMesh = (() => {
                  const object = new THREE.Object3D();
                  object.position.set(0, 1.4 - (1 * 0.2), -0.1);

                  const renderTarget = _makeRenderTarget(pixelWidth, pixelHeight);
                  object.render = (scene, camera) => {
                    renderer.render(scene, camera, renderTarget);
                    renderer.setRenderTarget(null);
                  };

                  const planeMesh = (() => {
                    const geometry = new THREE.PlaneBufferGeometry(width, height, 1, 1);
                    const material = (() => {
                      const shaderUniforms = THREE.UniformsUtils.clone(LENS_SHADER.uniforms);
                      const shaderMaterial = new THREE.ShaderMaterial({
                        uniforms: shaderUniforms,
                        vertexShader: LENS_SHADER.vertexShader,
                        fragmentShader: LENS_SHADER.fragmentShader,
                      })
                      shaderMaterial.uniforms.textureMap.value = renderTarget.texture;
                      // shaderMaterial.polygonOffset = true;
                      // shaderMaterial.polygonOffsetFactor = -1;
                      return shaderMaterial;
                    })();

                    const mesh = new THREE.Mesh(geometry, material);
                    return mesh;
                  })();
                  object.add(planeMesh);
                  object.planeMesh = planeMesh;

                  const lineMesh = _makeLineMesh();
                  object.add(lineMesh);
                  object.lineMesh = lineMesh;

                  return object;
                })();

                const meshes = [blurLensMesh, pixelLensMesh];
                this.meshes = meshes;

                meshes.forEach(mesh => {
                  scene.add(mesh);
                });

                const updateEye = eyeCamera => {
                  meshes.forEach(mesh => {
                    const {planeMesh, lineMesh} = mesh;

                    planeMesh.visible = false;
                    lineMesh.visible = false;
                  });

                  meshes.forEach(mesh => {
                    mesh.render(scene, eyeCamera);
                  });

                  meshes.forEach(mesh => {
                    const {planeMesh, lineMesh} = mesh;

                    planeMesh.visible = true;
                    lineMesh.visible = true;
                  });
                };
                updateEyes.push(updateEye);

                this._cleanup = () => {
                  meshes.forEach(mesh => {
                    scene.remove(mesh);
                  });

                  updateEyes.splice(updateEyes.indexOf(updateEye), 1);
                };
              }

              destructor() {
                this._cleanup();
              }

              set position(matrix) {
                const {meshes} = this;

                meshes.forEach((mesh, i) => {
                  mesh.position.set(matrix[0], matrix[1] + 1.4 - (i * 0.2), matrix[2] - 0.1);
                  mesh.quaternion.set(matrix[3], matrix[4], matrix[5], matrix[6]);
                  mesh.scale.set(matrix[7], matrix[8], matrix[9]);
                });
              }
            }
          ],
          templates: [
            {
              tag: 'lens',
              attributes: {},
              children: [],
            },
          ],
        };
      }
    });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Lens;
