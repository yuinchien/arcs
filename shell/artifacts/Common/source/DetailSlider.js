// @license
// Copyright (c) 2017 Google Inc. All rights reserved.
// This code may only be used under the BSD style license found at
// http://polymer.github.io/LICENSE.txt
// Code distributed by Google as part of this project is also
// subject to an additional IP rights grant found at
// http://polymer.github.io/PATENTS.txt

defineParticle(({DomParticle, resolver, html, log}) => {

  let host = `detail-slider`;

  const template = html`
<style>
  [${host}] {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    pointer-events: all;
    transform: translate3d(0, 100vh, 0);
    transition: transform 100ms ease-out;
  }
  [${host}][open] {
    transform: translate3d(0, 0, 0);
  }
  [${host}] > [scrim] {
    position: absolute;
    top: 0;
    right: 0;
    bottom: -64px;
    left: 0;
    pointer-events: all;
    background-color: gray;
    opacity: 0.25;
  }
  [${host}] > [dialog] {
    position: absolute;
    top: 4px;
    right: 4px;
    bottom: 4px;
    left: 4px;
    background-color: white;
    box-shadow: 0px 0px 8px 4px rgba(102,102,102,0.25);
    border-radius: 16px;
    overflow: auto;
  }
  [${host}] > [dialog] > [buttons] {
    border-bottom: 1px solid lightgrey;
    height: 56px;
  }
  [${host}] > [dialog] > [buttons] > [back-button] {
    background-color: transparent;
    border: none;
    border-radius: 100%;
    position: absolute;
    left: 8px;
    top: 8px;
    padding: 8px;
  }
  [${host}] > [dialog] > [buttons] > [back-button]:active {
    background-color: #b0e3ff;
  }
</style>

<div ${host} modal open$="{{open}}">
  <div scrim></div>
  <div dialog>
    <div buttons>
      <i back-button class="material-icons" on-click="onBack">close</i>
    </div>
    <div slot-content slotid="content"></div>
  </div>
</div>
    `.trim();

  return class extends DomParticle {
    get template() {
      return template;
    }
    _render({selected}, state) {
      let hide = true;
      const open = Boolean(selected && (selected.name || selected.id));
      if (open || state.open) {
        // we are or were open, so don't hide right away
        hide = false;
      }
      if (!open && state.open) {
        // about to close, wait for animation before hiding
        // state.open will be false next update (note: an update may occur before the timeout)
        setTimeout(() => this._setState(), 400);
      }
      // record new open state
      state.open = open;
      return {hide, open};
    }
    onBack() {
      // remove selection
      this._views.get('selected').clear();
    }
  };
});
