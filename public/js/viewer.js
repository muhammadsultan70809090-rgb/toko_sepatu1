/**
 * SneakerViewer
 * - Bila produk memiliki 2+ foto sudut (spinFrames), viewer memutar rangkaian
 *   foto tersebut sehingga sepatu benar-benar berputar 360°.
 * - Bila belum ada rangkaian foto, viewer menampilkan simulasi rotasi halus
 *   dari foto utama, dengan keterangan agar admin mengunggah foto sudut.
 */
export class SneakerViewer {
  constructor({ stage, image, slider, angleLabel, hint, badge }) {
    this.stage = stage;
    this.image = image;
    this.slider = slider;
    this.angleLabel = angleLabel;
    this.hint = hint;
    this.badge = badge;

    this.frames = [];
    this.fallback = '';
    this.angle = 0;
    this.dragging = false;
    this.lastX = 0;
    this.moved = 0;

    this.handleDown = this.handleDown.bind(this);
    this.handleMove = this.handleMove.bind(this);
    this.handleUp = this.handleUp.bind(this);
    this.handleSlider = this.handleSlider.bind(this);

    stage.addEventListener('pointerdown', this.handleDown);
    stage.addEventListener('pointermove', this.handleMove);
    stage.addEventListener('pointerup', this.handleUp);
    stage.addEventListener('pointercancel', this.handleUp);
    slider.addEventListener('input', this.handleSlider);

    const step = (direction) => {
      const delta = this.mode === 'frames' ? 360 / Math.max(this.frames.length, 1) : 12;
      this.setAngle(this.angle + direction * delta);
    };
    document.querySelectorAll('[data-viewer-step]').forEach((button) => {
      button.addEventListener('click', () => step(Number(button.dataset.viewerStep) || 1));
    });
  }

  setProduct(product) {
    this.frames = Array.isArray(product.spinFrames) ? product.spinFrames.filter(Boolean) : [];
    this.mode = this.frames.length >= 2 ? 'frames' : 'simulated';
    this.fallback = product.image || '';
    this.angle = 0;

    if (this.badge) {
      this.badge.textContent =
        this.mode === 'frames' ? `${this.frames.length} ANGLE FRAMES` : 'SIMULATED TURNTABLE';
    }
    if (this.hint) {
      this.hint.textContent =
        this.mode === 'frames'
          ? 'Geser sepatu ke kiri atau kanan untuk memutar seluruh rangkaian foto sudut 360°.'
          : 'Geser untuk memutar sepatu (turntable 3D). Unggah 24–36 foto sudut melalui dashboard admin untuk 360° foto asli.';
    }
    this.slider.value = 0;
    this.render();
  }

  handleDown(event) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    this.dragging = true;
    this.lastX = event.clientX;
    this.moved = 0;
    this.stage.setPointerCapture?.(event.pointerId);
  }

  handleMove(event) {
    if (!this.dragging) return;
    const dx = event.clientX - this.lastX;
    this.lastX = event.clientX;
    this.moved += Math.abs(dx);
    if (!dx) return;
    const sensitivity = this.mode === 'frames' ? 360 / (this.frames.length * 26) : 1.1;
    this.setAngle(this.angle + dx * sensitivity);
  }

  handleUp(event) {
    if (!this.dragging) return;
    this.dragging = false;
    this.stage.releasePointerCapture?.(event.pointerId);
  }

  handleSlider() {
    this.setAngle(Number(this.slider.value) || 0);
  }

  setAngle(next) {
    const angle = ((next % 360) + 360) % 360;
    this.angle = angle;
    this.slider.value = String(Math.round(angle));
    this.render();
  }

  render() {
    const angle = this.angle;
    if (this.mode === 'frames') {
      const index = Math.round((angle / 360) * this.frames.length) % this.frames.length;
      this.image.src = this.frames[index];
      if (this.angleLabel) {
        this.angleLabel.textContent = `${index + 1} / ${this.frames.length}`;
      }
      this.image.style.transform = '';
      this.image.style.filter = '';
      return;
    }

    const radians = (angle * Math.PI) / 180;
    const scale = Math.cos(radians);
    const tilt = Math.sin(radians) * 5;
    const brightness = 0.9 + Math.abs(scale) * 0.1;

    if (!this.image.src) this.image.src = this.fallback;
    this.image.style.transform = `scaleX(${scale.toFixed(3)}) translateY(${tilt.toFixed(2)}px)`;
    this.image.style.filter = `brightness(${brightness.toFixed(2)}) drop-shadow(0 24px 18px rgba(54,24,39,.26))`;
    if (this.angleLabel) this.angleLabel.textContent = `${Math.round(angle)}°`;

    // Sinkronkan foto utama agar frame simulasi tidak kembali ke gambar lama.
    if (this.fallback && this.image.src.split('/').pop() !== this.fallback.split('/').pop()) {
      this.image.src = this.fallback;
    }
  }
}
