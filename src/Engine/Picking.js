import THREE from 'three';
import Point from '../geo/Point';
import PickingScene from './PickingScene';

// TODO: Look into a way of setting this up without passing in a renderer and
// camera from the engine

// TODO: Add a basic indicator on or around the mouse pointer when it is over
// something pickable / clickable
//
// A simple transparent disc or ring at the mouse point should work to start

var nextId = 1;

class Picking {
  constructor(world, renderer, camera) {
    this._world = world;
    this._renderer = renderer;
    this._camera = camera;

    this._pickingScene = PickingScene;
    this._pickingTexture = new THREE.WebGLRenderTarget();
    this._pickingTexture.texture.minFilter = THREE.LinearFilter;
    this._pickingTexture.texture.generateMipmaps = false;

    this._nextId = 1;

    this._resizeTexture();
    this._initEvents();
  }

  _initEvents() {
    window.addEventListener('resize', this._resizeTexture.bind(this), false);

    // this._renderer.domElement.addEventListener('mousemove', this._onMouseMove.bind(this), false);
    this._renderer.domElement.addEventListener('mouseup', this._onMouseUp.bind(this), false);

    this._world.on('move', this._onWorldMove, this);
  }

  _onMouseUp(event) {
    // Only react to main button click
    if (event.button !== 0) {
      return;
    }

    this._pick(VIZI.Point(event.clientX, event.clientY));
  }

  _onWorldMove() {
    this._needUpdate = true;
  }

  // TODO: Ensure this doesn't get out of sync issue with the renderer resize
  _resizeTexture() {
    var size = this._renderer.getSize();
    this._pickingTexture.setSize(size.width, size.height);
    this._pixelBuffer = new Uint8Array(4 * size.width * size.height);
    this._needUpdate = true;
  }

  // TODO: Make this only re-draw the scene if both an update is needed and the
  // camera has moved since the last update
  //
  // Otherwise it re-draws the scene on every click due to the way LOD updates
  // work in TileLayer – spamming this.add() and this.remove()
  _update() {
    if (this._needUpdate) {
      var texture = this._pickingTexture;

      this._renderer.render(this._pickingScene, this._camera, this._pickingTexture);

      // Read the rendering texture
      this._renderer.readRenderTargetPixels(texture, 0, 0, texture.width, texture.height, this._pixelBuffer);

      this._needUpdate = false;
    }
  }

  _pick(point) {
    this._update();

    var index = point.x + (this._pickingTexture.height - point.y) * this._pickingTexture.width;

    // Interpret the pixel as an ID
    var id = (this._pixelBuffer[index * 4 + 2] * 255 * 255) + (this._pixelBuffer[index * 4 + 1] * 255) + (this._pixelBuffer[index * 4 + 0]);

    // Skip if ID is 16646655 (white) as the background returns this
    if (id === 16646655) {
      return;
    }

    this._world.emit('pick', id);
    this._world.emit('pick-' + id);

    console.log('Pick id:', id);
  }

  // Add mesh to picking scene
  //
  // Picking ID should already be added as an attribute
  add(mesh) {
    this._pickingScene.add(mesh);
    this._needUpdate = true;
  }

  // Remove mesh from picking scene
  remove(mesh) {
    this._pickingScene.remove(mesh);
    this._needUpdate = true;
  }

  // Returns next ID to use for picking
  getNextId() {
    return nextId++;
  }

  destroy() {
    // TODO: Find a way to properly remove these listeners as they stay
    // active at the moment
    window.removeEventListener('resize', this._resizeTexture, false);
    this._renderer.domElement.removeEventListener('mouseup', this._onMouseUp, false);
    this._world.off('move', this._onWorldMove);

    if (this._pickingScene.children) {
      // Remove everything else in the layer
      var child;
      for (var i = this._pickingScene.children.length - 1; i >= 0; i--) {
        child = this._pickingScene.children[i];

        if (!child) {
          continue;
        }

        this._pickingScene.remove(child);

        // Probably not a good idea to dispose of geometry due to it being
        // shared with the non-picking scene
        // if (child.geometry) {
        //   // Dispose of mesh and materials
        //   child.geometry.dispose();
        //   child.geometry = null;
        // }

        if (child.material) {
          if (child.material.map) {
            child.material.map.dispose();
            child.material.map = null;
          }

          child.material.dispose();
          child.material = null;
        }
      }
    }

    this._pickingScene = null;
    this._pickingTexture = null;
    this._pixelBuffer = null;

    this._world = null;
    this._renderer = null;
    this._camera = null;
  }
}

// Initialise without requiring new keyword
export default function(world, renderer, camera) {
  return new Picking(world, renderer, camera);
};
